require('dotenv').config();
const mysql = require('mysql2/promise');

let isSyncing = false;

// Rentang hari absensi yang dibandingkan antara Lokal (XAMPP) <-> Cloud (Aiven/TiDB)
const ABSENSI_SYNC_DAYS = 60;

// =========================================================================
// SINKRONISASI ABSENSI DUA ARAH (Last-Write-Wins)
// - Kunci baris  : (id_karyawan, tanggal)  -> BUKAN id_absensi (id di Lokal & Cloud berbeda)
// - Penentu menang: kolom updated_at (dibandingkan dalam detik epoch, aman beda timezone)
// - Penghapusan   : dicatat di tabel absensi_deleted ("nisan") agar ikut terhapus di sisi lain
// =========================================================================
async function ensureAbsensiSyncSchema(db) {
    const [cols] = await db.query("SHOW COLUMNS FROM absensi LIKE 'updated_at'");
    if (cols.length === 0) {
        await db.query("ALTER TABLE absensi ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        // Data lama diberi waktu yang SAMA di kedua database agar tidak saling menimpa secara acak
        await db.query("UPDATE absensi SET updated_at = FROM_UNIXTIME(946684800)");
    }
    await db.query(`
        CREATE TABLE IF NOT EXISTS absensi_deleted (
            id_karyawan VARCHAR(50) NOT NULL,
            tanggal DATE NOT NULL,
            deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_karyawan, tanggal)
        ) ENGINE=InnoDB
    `);
}

async function syncAbsensiTwoWay(localDb, cloudDb) {
    await ensureAbsensiSyncSchema(localDb);
    await ensureAbsensiSyncSchema(cloudDb);

    const selRows = `
        SELECT id_karyawan, DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal,
               jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit,
               UNIX_TIMESTAMP(updated_at) AS ts
        FROM absensi WHERE tanggal >= CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS} DAY`;
    const selTomb = `
        SELECT id_karyawan, DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, UNIX_TIMESTAMP(deleted_at) AS ts
        FROM absensi_deleted WHERE tanggal >= CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS} DAY`;

    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);
    const [localTomb] = await localDb.query(selTomb);
    const [cloudTomb] = await cloudDb.query(selTomb);

    const keyOf = (r) => `${String(r.id_karyawan).trim().toLowerCase()}|${r.tanggal}`;
    const L = new Map(localRows.map(r => [keyOf(r), { ...r, ts: Number(r.ts) }]));
    const C = new Map(cloudRows.map(r => [keyOf(r), { ...r, ts: Number(r.ts) }]));

    // Gabungkan "nisan" dari kedua sisi (ambil yang terbaru) lalu salin ke sisi yang belum punya
    const T = new Map();
    for (const t of [...localTomb, ...cloudTomb]) {
        const k = keyOf(t);
        const ts = Number(t.ts);
        if (!T.has(k) || T.get(k).ts < ts) T.set(k, { ...t, ts });
    }
    for (const t of T.values()) {
        for (const db of [localDb, cloudDb]) {
            await db.query(
                `INSERT INTO absensi_deleted (id_karyawan, tanggal, deleted_at) VALUES (?, ?, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE deleted_at = GREATEST(deleted_at, VALUES(deleted_at))`,
                [t.id_karyawan, t.tanggal, t.ts]
            ).catch(() => {});
        }
    }

    const sameData = (a, b) => {
        const n = (v) => (v === null || v === undefined ? '' : String(v));
        return ['jam_masuk', 'jam_keluar', 'status', 'keterangan'].every(f => n(a[f]) === n(b[f])) &&
               Number(a.telat_menit || 0) === Number(b.telat_menit || 0) &&
               Number(a.psw_menit || 0) === Number(b.psw_menit || 0);
    };

    // Tulis baris (src) ke database tujuan, updated_at ikut disalin agar tidak saling memantul
    const writeRow = (db, r) => db.query(
        `INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
         ON DUPLICATE KEY UPDATE
            jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status),
            keterangan = VALUES(keterangan), telat_menit = VALUES(telat_menit), psw_menit = VALUES(psw_menit),
            updated_at = VALUES(updated_at)`,
        [r.id_karyawan, r.tanggal, r.jam_masuk, r.jam_keluar, r.status, r.keterangan, r.telat_menit || 0, r.psw_menit || 0, r.ts]
    );
    const deleteRow = (db, r) => db.query('DELETE FROM absensi WHERE id_karyawan = ? AND tanggal = ?', [r.id_karyawan, r.tanggal]);

    let toCloud = 0, toLocal = 0, delLocal = 0, delCloud = 0;
    const keys = new Set([...L.keys(), ...C.keys()]);
    for (const k of keys) {
        const l = L.get(k), c = C.get(k), t = T.get(k);
        try {
            const newest = Math.max(l ? l.ts : 0, c ? c.ts : 0);

            // Dihapus di salah satu sisi dan penghapusan lebih baru dari data -> hapus di kedua sisi
            if (t && t.ts >= newest) {
                if (l) { await deleteRow(localDb, l); delLocal++; }
                if (c) { await deleteRow(cloudDb, c); delCloud++; }
                continue;
            }

            if (l && c) {
                if (l.ts > c.ts) { await writeRow(cloudDb, l); toCloud++; }
                else if (c.ts > l.ts) { await writeRow(localDb, c); toLocal++; }
                else if (!sameData(l, c)) { await writeRow(cloudDb, l); toCloud++; } // seri: Lokal menang
            } else if (l) {
                await writeRow(cloudDb, l); toCloud++;
            } else if (c) {
                await writeRow(localDb, c); toLocal++;
            }
        } catch (e) {
            // Contoh: karyawan belum ada di salah satu database (FK) -> dicoba lagi di putaran berikutnya
        }
    }

    // Bersihkan "nisan" lama
    await localDb.query(`DELETE FROM absensi_deleted WHERE tanggal < CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS + 30} DAY`).catch(() => {});
    await cloudDb.query(`DELETE FROM absensi_deleted WHERE tanggal < CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS + 30} DAY`).catch(() => {});

    return { toCloud, toLocal, delLocal, delCloud };
}

async function startSync() {
    // Di Server Cloud (Render) database-nya adalah Cloud itu sendiri -> tidak ada yang perlu disinkronkan
    const dbHost = process.env.DB_HOST || '';
    if (!process.env.CLOUD_DB_HOST || dbHost.includes('aivencloud') || dbHost.includes('tidbcloud')) {
        console.log("ℹ️ Sinkronisasi XAMPP <-> Cloud dilewati (server ini memakai database Cloud langsung).");
        return;
    }

    console.log("==================================================");
    console.log("🚀 SINKRONISASI DUA ARAH AKTIF (XAMPP <-> CLOUD)");
    console.log("==================================================");

    const runSync = async () => {
        if (isSyncing) return;
        isSyncing = true;

        let localDb = null;
        let cloudDb = null;
        try {
            // 1. Koneksi ke Lokal
            localDb = await mysql.createConnection({
                host: process.env.DB_HOST || '127.0.0.1',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASS || '',
                database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
                dateStrings: true,
                timezone: '+07:00'
            });

            // 2. Koneksi ke Cloud Database (TiDB Cloud / Aiven)
            const cloudSsl = (process.env.CLOUD_DB_HOST && process.env.CLOUD_DB_HOST.includes('tidbcloud'))
                ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
                : { rejectUnauthorized: false };

            cloudDb = await mysql.createConnection({
                host: process.env.CLOUD_DB_HOST,
                port: process.env.CLOUD_DB_PORT || 4000,
                user: process.env.CLOUD_DB_USER,
                password: process.env.CLOUD_DB_PASS,
                database: process.env.CLOUD_DB_NAME,
                ssl: cloudSsl,
                dateStrings: true,
                timezone: '+07:00'
            });

            const now = new Date().toLocaleString();
            console.log(`[${now}] Memulai sinkronisasi otomatis...`);

            // --- SYNC KARYAWAN (Jika ada pegawai baru/update foto) ---
            // (Dijalankan SEBELUM absensi agar pegawai baru sudah ada di Cloud saat absensinya dikirim)
            const [karyawanList] = await localDb.query("SELECT * FROM karyawan");
            if (karyawanList.length > 0) {
                const kValues = karyawanList.map(k => [k.id_karyawan, k.nama, k.jabatan, k.face_descriptor, k.foto, k.tanggal_registrasi]);
                await cloudDb.query(
                    `INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto, tanggal_registrasi) 
                     VALUES ? 
                     ON DUPLICATE KEY UPDATE 
                     nama = VALUES(nama), jabatan = VALUES(jabatan), face_descriptor = VALUES(face_descriptor), foto = VALUES(foto)`,
                    [kValues]
                );
            }

            // --- SYNC ABSENSI DUA ARAH (60 Hari Terakhir, Last-Write-Wins) ---
            let absensiInfo = { toCloud: 0, toLocal: 0, delLocal: 0, delCloud: 0 };
            try {
                absensiInfo = await syncAbsensiTwoWay(localDb, cloudDb);
            } catch (eAbs) {
                console.error('⚠️ Sync absensi dua arah error:', eAbs.message);
            }

            // --- SYNC AKUN PORTAL (per baris, dicocokkan lewat id_karyawan) ---
            // [FIX] Dulu memakai 1 INSERT massal yang membawa id_akun Cloud ke Lokal.
            // id_akun di kedua DB berbeda, sehingga 1 bentrok saja membuat SELURUH statement gagal
            // (dan error-nya disembunyikan) -> akun baru dari Portal tidak pernah muncul di dashboard lokal.
            // Sekarang: Cloud (Portal) = sumber kebenaran akun & password.
            try {
                const norm = (v) => String(v || '').trim().toLowerCase();
                const [akunCloud] = await cloudDb.query("SELECT id_karyawan, username, password, created_at FROM akun_pegawai");
                const [akunLocal] = await localDb.query("SELECT id_akun, id_karyawan, username, password FROM akun_pegawai");
                const [karyawanLokal] = await localDb.query("SELECT id_karyawan FROM karyawan");

                const localKaryawanMap = new Map(karyawanLokal.map(k => [norm(k.id_karyawan), k.id_karyawan]));
                const localAkunMap = new Map(akunLocal.map(a => [norm(a.id_karyawan), a]));
                const cloudAkunSet = new Set(akunCloud.map(a => norm(a.id_karyawan)));

                let akunMasuk = 0, akunUpdate = 0, akunGagal = 0;

                // LANGKAH 1: Cloud -> Lokal
                for (const ak of akunCloud) {
                    const key = norm(ak.id_karyawan);
                    const localId = localKaryawanMap.get(key);
                    if (!localId) continue; // pegawai tidak ada di lokal
                    const existing = localAkunMap.get(key);
                    try {
                        if (existing) {
                            if (existing.username !== ak.username || existing.password !== ak.password) {
                                await localDb.query('UPDATE akun_pegawai SET username = ?, password = ? WHERE id_akun = ?',
                                    [ak.username, ak.password, existing.id_akun]);
                                akunUpdate++;
                            }
                        } else {
                            await localDb.query('INSERT INTO akun_pegawai (id_karyawan, username, password, created_at) VALUES (?, ?, ?, ?)',
                                [localId, ak.username, ak.password, ak.created_at]);
                            akunMasuk++;
                        }
                    } catch (e) {
                        akunGagal++;
                        console.error(`⚠️ Sync akun ${ak.id_karyawan} (${ak.username}) ke lokal gagal: ${e.message}`);
                    }
                }

                // LANGKAH 2: Lokal -> Cloud (hanya akun yang BELUM ada di Cloud, tidak menimpa password Cloud)
                for (const ak of akunLocal) {
                    if (cloudAkunSet.has(norm(ak.id_karyawan))) continue;
                    try {
                        await cloudDb.query('INSERT INTO akun_pegawai (id_karyawan, username, password) VALUES (?, ?, ?)',
                            [ak.id_karyawan, ak.username, ak.password]);
                    } catch (e) {
                        console.error(`⚠️ Sync akun ${ak.id_karyawan} (${ak.username}) ke cloud gagal: ${e.message}`);
                    }
                }

                if (akunMasuk || akunUpdate || akunGagal) {
                    console.log(`👤 Sync akun portal: ${akunMasuk} baru, ${akunUpdate} diperbarui, ${akunGagal} gagal`);
                }
            } catch (e) {
                console.error('⚠️ Sync akun portal error:', e.message);
            }

            // --- SYNC REQ UBAH PASSWORD (AIVEN <-> XAMPP) ---
            try {
                // 1. Kirim status yang sudah 'approved'/'rejected' dari Lokal (XAMPP) ke Cloud (Aiven) TERLEBIH DAHULU
                const [reqSelesaiLokal] = await localDb.query("SELECT * FROM req_ubah_password WHERE status IN ('approved', 'rejected')");
                for (const r of reqSelesaiLokal) {
                    await cloudDb.query(
                        `UPDATE req_ubah_password SET status = ? WHERE id_req = ?`,
                        [r.status, r.id_req]
                    );
                }

                // 2. Baru Tarik permintaan 'pending' dari Cloud (Aiven) ke Lokal (XAMPP)
                const [reqPendingCloud] = await cloudDb.query("SELECT * FROM req_ubah_password WHERE status = 'pending'");
                if (reqPendingCloud.length > 0) {
                    for (const req of reqPendingCloud) {
                        try {
                            await localDb.query(
                                `INSERT INTO req_ubah_password (id_req, id_karyawan, password_baru, status, created_at) 
                                 VALUES (?, ?, ?, ?, ?) 
                                 ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                                [req.id_req, req.id_karyawan, req.password_baru, req.status, req.created_at]
                            );
                        } catch (e) {
                            // console.error(`⚠️ Abaikan req_ubah_password ID ${req.id_req} (Karyawan ${req.id_karyawan} tidak ada di lokal)`);
                        }
                    }
                }
            } catch (e) {
                // Ignore if table doesn't exist yet
            }

            // --- SYNC AKSES SCAN PORTAL (Dashboard Admin Lokal -> Portal Online Cloud) ---
            try {
                const createAksesSql = `
                    CREATE TABLE IF NOT EXISTS akses_scan_portal (
                        id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
                        aktif TINYINT(1) DEFAULT 0,
                        hari_diizinkan VARCHAR(100) DEFAULT '',
                        tanggal_khusus VARCHAR(20) DEFAULT NULL,
                        mode_kehadiran VARCHAR(30) DEFAULT 'SCAN_FULL_HADIR',
                        keterangan_default VARCHAR(255) DEFAULT 'Jadwal Libur Mingguan (Tetap Masuk via Portal)',
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB
                `;
                await localDb.query(createAksesSql);
                await cloudDb.query(createAksesSql);

                const [aksesLocal] = await localDb.query("SELECT * FROM akses_scan_portal");
                for (const asp of aksesLocal) {
                    await cloudDb.query(
                        `INSERT INTO akses_scan_portal (id_karyawan, aktif, hari_diizinkan, tanggal_khusus, mode_kehadiran, keterangan_default)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         aktif = VALUES(aktif),
                         hari_diizinkan = VALUES(hari_diizinkan),
                         tanggal_khusus = VALUES(tanggal_khusus),
                         mode_kehadiran = VALUES(mode_kehadiran),
                         keterangan_default = VALUES(keterangan_default)`,
                        [asp.id_karyawan, asp.aktif, asp.hari_diizinkan, asp.tanggal_khusus, asp.mode_kehadiran, asp.keterangan_default]
                    );
                }
            } catch (eSyncPortal) {
                console.error('⚠️ Sync akses_scan_portal error:', eSyncPortal.message);
            }

            console.log(`✅ Sinkronisasi sukses! Absensi: ${absensiInfo.toCloud} ke Cloud, ${absensiInfo.toLocal} ke Lokal, hapus ${absensiInfo.delLocal} Lokal / ${absensiInfo.delCloud} Cloud`);

        } catch (error) {
            console.error(`❌ Gagal Sinkronisasi:`, error.message);
        } finally {
            if (localDb) await localDb.end().catch(() => {});
            if (cloudDb) await cloudDb.end().catch(() => {});
            isSyncing = false;
        }
    };

    // Jalankan pertama kali saat server start
    runSync();

    // Looping terus menerus setiap 1 Menit (60.000 ms)
    setInterval(runSync, 60000);
}

startSync();
