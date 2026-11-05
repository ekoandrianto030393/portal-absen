require('dotenv').config();
const mysql = require('mysql2/promise');

let isSyncing = false;

// Rentang hari absensi yang disinkronkan dua arah
const ABSENSI_SYNC_DAYS = 60;

// =========================================================================
// 1. ENSURE SCHEMAS (Auto-Migrasi Kolom updated_at & Tabel Deleted/Tombstone)
// =========================================================================
async function ensureAllSyncSchemas(db) {
    // 1. Absensi
    const [absCols] = await db.query("SHOW COLUMNS FROM absensi LIKE 'updated_at'");
    if (absCols.length === 0) {
        await db.query("ALTER TABLE absensi ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
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

    // 2. Karyawan
    const [kCols] = await db.query("SHOW COLUMNS FROM karyawan LIKE 'updated_at'");
    if (kCols.length === 0) {
        await db.query("ALTER TABLE karyawan ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        await db.query("UPDATE karyawan SET updated_at = FROM_UNIXTIME(946684800)");
    }
    await db.query(`
        CREATE TABLE IF NOT EXISTS karyawan_deleted (
            id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
            deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);

    // 3. Akun Pegawai
    const [apCols] = await db.query("SHOW COLUMNS FROM akun_pegawai LIKE 'updated_at'");
    if (apCols.length === 0) {
        await db.query("ALTER TABLE akun_pegawai ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        await db.query("UPDATE akun_pegawai SET updated_at = FROM_UNIXTIME(946684800)");
    }
    await db.query(`
        CREATE TABLE IF NOT EXISTS akun_pegawai_deleted (
            id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
            deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);

    // 4. Req Ubah Password
    const [reqCols] = await db.query("SHOW COLUMNS FROM req_ubah_password LIKE 'updated_at'");
    if (reqCols.length === 0) {
        await db.query("ALTER TABLE req_ubah_password ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        await db.query("UPDATE req_ubah_password SET updated_at = FROM_UNIXTIME(946684800)");
    }

    // 5. Akses Scan Portal
    await db.query(`
        CREATE TABLE IF NOT EXISTS akses_scan_portal (
            id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
            aktif TINYINT(1) DEFAULT 0,
            hari_diizinkan VARCHAR(100) DEFAULT '',
            tanggal_khusus VARCHAR(20) DEFAULT NULL,
            mode_kehadiran VARCHAR(30) DEFAULT 'SCAN_FULL_HADIR',
            keterangan_default VARCHAR(255) DEFAULT 'Jadwal Libur Mingguan (Tetap Masuk via Portal)',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);
}

// =========================================================================
// 2. SINKRONISASI KARYAWAN DUA ARAH (Lokal 🔁 Cloud, Last-Write-Wins)
// =========================================================================
async function syncKaryawanTwoWay(localDb, cloudDb) {
    const selRows = `
        SELECT id_karyawan, nama, jabatan, face_descriptor, foto,
               DATE_FORMAT(tanggal_registrasi, '%Y-%m-%d %H:%i:%s') AS tanggal_registrasi,
               no_urut, UNIX_TIMESTAMP(updated_at) AS ts
        FROM karyawan`;
    const selTomb = `SELECT id_karyawan, UNIX_TIMESTAMP(deleted_at) AS ts FROM karyawan_deleted`;

    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);
    const [localTomb] = await localDb.query(selTomb);
    const [cloudTomb] = await cloudDb.query(selTomb);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const L = new Map(localRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));
    const C = new Map(cloudRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));

    const T = new Map();
    for (const t of [...localTomb, ...cloudTomb]) {
        const k = norm(t.id_karyawan);
        const ts = Number(t.ts);
        if (!T.has(k) || T.get(k).ts < ts) T.set(k, { ...t, ts });
    }
    for (const t of T.values()) {
        for (const db of [localDb, cloudDb]) {
            await db.query(
                `INSERT INTO karyawan_deleted (id_karyawan, deleted_at) VALUES (?, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE deleted_at = GREATEST(deleted_at, VALUES(deleted_at))`,
                [t.id_karyawan, t.ts]
            ).catch(() => {});
        }
    }

    const writeRow = (db, r) => db.query(
        `INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto, tanggal_registrasi, no_urut, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
         ON DUPLICATE KEY UPDATE
            nama = VALUES(nama),
            jabatan = VALUES(jabatan),
            face_descriptor = COALESCE(VALUES(face_descriptor), face_descriptor),
            foto = COALESCE(VALUES(foto), foto),
            no_urut = VALUES(no_urut),
            updated_at = VALUES(updated_at)`,
        [r.id_karyawan, r.nama, r.jabatan, r.face_descriptor, r.foto, r.tanggal_registrasi || null, r.no_urut || 9999, r.ts]
    );
    const deleteRow = (db, id) => db.query('DELETE FROM karyawan WHERE LOWER(TRIM(id_karyawan)) = LOWER(TRIM(?))', [id]);

    let toCloud = 0, toLocal = 0, delLocal = 0, delCloud = 0;
    const keys = new Set([...L.keys(), ...C.keys()]);
    for (const k of keys) {
        const l = L.get(k), c = C.get(k), t = T.get(k);
        try {
            const newest = Math.max(l ? l.ts : 0, c ? c.ts : 0);
            if (t && t.ts >= newest) {
                if (l) { await deleteRow(localDb, l.id_karyawan); delLocal++; }
                if (c) { await deleteRow(cloudDb, c.id_karyawan); delCloud++; }
                continue;
            }

            if (l && c) {
                if (l.ts > c.ts) { await writeRow(cloudDb, l); toCloud++; }
                else if (c.ts > l.ts) { await writeRow(localDb, c); toLocal++; }
            } else if (l) {
                await writeRow(cloudDb, l); toCloud++;
            } else if (c) {
                await writeRow(localDb, c); toLocal++;
            }
        } catch (e) {
            console.error(`⚠️ Sync karyawan ${k} error:`, e.message);
        }
    }

    return { toCloud, toLocal, delLocal, delCloud };
}

// =========================================================================
// 3. SINKRONISASI ABSENSI DUA ARAH (Lokal 🔁 Cloud, Last-Write-Wins)
// =========================================================================
async function syncAbsensiTwoWay(localDb, cloudDb) {
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
            if (t && t.ts >= newest) {
                if (l) { await deleteRow(localDb, l); delLocal++; }
                if (c) { await deleteRow(cloudDb, c); delCloud++; }
                continue;
            }

            if (l && c) {
                if (l.ts > c.ts) { await writeRow(cloudDb, l); toCloud++; }
                else if (c.ts > l.ts) { await writeRow(localDb, c); toLocal++; }
                else if (!sameData(l, c)) { await writeRow(cloudDb, l); toCloud++; }
            } else if (l) {
                await writeRow(cloudDb, l); toCloud++;
            } else if (c) {
                await writeRow(localDb, c); toLocal++;
            }
        } catch (e) {
            // Ignored
        }
    }

    await localDb.query(`DELETE FROM absensi_deleted WHERE tanggal < CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS + 30} DAY`).catch(() => {});
    await cloudDb.query(`DELETE FROM absensi_deleted WHERE tanggal < CURDATE() - INTERVAL ${ABSENSI_SYNC_DAYS + 30} DAY`).catch(() => {});

    return { toCloud, toLocal, delLocal, delCloud };
}

// =========================================================================
// 4. SINKRONISASI AKUN PEGAWAI DUA ARAH (Lokal 🔁 Cloud, Last-Write-Wins)
// =========================================================================
async function syncAkunPegawaiTwoWay(localDb, cloudDb) {
    const selRows = `
        SELECT id_karyawan, username, password,
               DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
               UNIX_TIMESTAMP(updated_at) AS ts
        FROM akun_pegawai`;
    const selTomb = `SELECT id_karyawan, UNIX_TIMESTAMP(deleted_at) AS ts FROM akun_pegawai_deleted`;

    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);
    const [localTomb] = await localDb.query(selTomb);
    const [cloudTomb] = await cloudDb.query(selTomb);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const L = new Map(localRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));
    const C = new Map(cloudRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));

    const T = new Map();
    for (const t of [...localTomb, ...cloudTomb]) {
        const k = norm(t.id_karyawan);
        const ts = Number(t.ts);
        if (!T.has(k) || T.get(k).ts < ts) T.set(k, { ...t, ts });
    }
    for (const t of T.values()) {
        for (const db of [localDb, cloudDb]) {
            await db.query(
                `INSERT INTO akun_pegawai_deleted (id_karyawan, deleted_at) VALUES (?, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE deleted_at = GREATEST(deleted_at, VALUES(deleted_at))`,
                [t.id_karyawan, t.ts]
            ).catch(() => {});
        }
    }

    const writeRow = (db, r) => db.query(
        `INSERT INTO akun_pegawai (id_karyawan, username, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))
         ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            password = VALUES(password),
            updated_at = VALUES(updated_at)`,
        [r.id_karyawan, r.username, r.password, r.created_at || null, r.ts]
    );
    const deleteRow = (db, id) => db.query('DELETE FROM akun_pegawai WHERE LOWER(TRIM(id_karyawan)) = LOWER(TRIM(?))', [id]);

    let toCloud = 0, toLocal = 0, delLocal = 0, delCloud = 0;
    const keys = new Set([...L.keys(), ...C.keys()]);
    for (const k of keys) {
        const l = L.get(k), c = C.get(k), t = T.get(k);
        try {
            const newest = Math.max(l ? l.ts : 0, c ? c.ts : 0);
            if (t && t.ts >= newest) {
                if (l) { await deleteRow(localDb, l.id_karyawan); delLocal++; }
                if (c) { await deleteRow(cloudDb, c.id_karyawan); delCloud++; }
                continue;
            }

            if (l && c) {
                if (l.ts > c.ts) { await writeRow(cloudDb, l); toCloud++; }
                else if (c.ts > l.ts) { await writeRow(localDb, c); toLocal++; }
            } else if (l) {
                await writeRow(cloudDb, l); toCloud++;
            } else if (c) {
                await writeRow(localDb, c); toLocal++;
            }
        } catch (e) {
            // Ignored
        }
    }

    return { toCloud, toLocal, delLocal, delCloud };
}

// =========================================================================
// 5. SINKRONISASI REQ UBAH PASSWORD DUA ARAH (Lokal 🔁 Cloud, Last-Write-Wins)
// =========================================================================
async function syncReqUbahPasswordTwoWay(localDb, cloudDb) {
    const selRows = `
        SELECT id_req, id_karyawan, password_baru, status,
               DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
               UNIX_TIMESTAMP(updated_at) AS ts
        FROM req_ubah_password`;

    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const keyOf = (r) => `${norm(r.id_karyawan)}|${r.created_at}`;

    const L = new Map(localRows.map(r => [keyOf(r), { ...r, ts: Number(r.ts) }]));
    const C = new Map(cloudRows.map(r => [keyOf(r), { ...r, ts: Number(r.ts) }]));

    let toCloud = 0, toLocal = 0;
    const keys = new Set([...L.keys(), ...C.keys()]);
    for (const k of keys) {
        const l = L.get(k), c = C.get(k);
        try {
            if (l && c) {
                if (l.ts > c.ts) {
                    await cloudDb.query(
                        `UPDATE req_ubah_password SET status = ?, password_baru = ?, updated_at = FROM_UNIXTIME(?) WHERE id_req = ?`,
                        [l.status, l.password_baru, l.ts, c.id_req]
                    );
                    toCloud++;
                } else if (c.ts > l.ts) {
                    await localDb.query(
                        `UPDATE req_ubah_password SET status = ?, password_baru = ?, updated_at = FROM_UNIXTIME(?) WHERE id_req = ?`,
                        [c.status, c.password_baru, c.ts, l.id_req]
                    );
                    toLocal++;
                }
            } else if (l) {
                await cloudDb.query(
                    `INSERT INTO req_ubah_password (id_karyawan, password_baru, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
                    [l.id_karyawan, l.password_baru, l.status, l.created_at, l.ts]
                );
                toCloud++;
            } else if (c) {
                await localDb.query(
                    `INSERT INTO req_ubah_password (id_karyawan, password_baru, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
                    [c.id_karyawan, c.password_baru, c.status, c.created_at, c.ts]
                );
                toLocal++;
            }
        } catch (e) {
            // Ignored
        }
    }

    return { toCloud, toLocal };
}

// =========================================================================
// 6. SINKRONISASI AKSES SCAN PORTAL DUA ARAH (Lokal 🔁 Cloud, Last-Write-Wins)
// =========================================================================
async function syncAksesScanPortalTwoWay(localDb, cloudDb) {
    const selRows = `
        SELECT id_karyawan, aktif, hari_diizinkan, tanggal_khusus, mode_kehadiran, keterangan_default,
               UNIX_TIMESTAMP(updated_at) AS ts
        FROM akses_scan_portal`;

    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const L = new Map(localRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));
    const C = new Map(cloudRows.map(r => [norm(r.id_karyawan), { ...r, ts: Number(r.ts) }]));

    const writeRow = (db, r) => db.query(
        `INSERT INTO akses_scan_portal (id_karyawan, aktif, hari_diizinkan, tanggal_khusus, mode_kehadiran, keterangan_default, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
         ON DUPLICATE KEY UPDATE
            aktif = VALUES(aktif),
            hari_diizinkan = VALUES(hari_diizinkan),
            tanggal_khusus = VALUES(tanggal_khusus),
            mode_kehadiran = VALUES(mode_kehadiran),
            keterangan_default = VALUES(keterangan_default),
            updated_at = VALUES(updated_at)`,
        [r.id_karyawan, r.aktif, r.hari_diizinkan, r.tanggal_khusus, r.mode_kehadiran, r.keterangan_default, r.ts]
    );

    let toCloud = 0, toLocal = 0;
    const keys = new Set([...L.keys(), ...C.keys()]);
    for (const k of keys) {
        const l = L.get(k), c = C.get(k);
        try {
            if (l && c) {
                if (l.ts > c.ts) { await writeRow(cloudDb, l); toCloud++; }
                else if (c.ts > l.ts) { await writeRow(localDb, c); toLocal++; }
            } else if (l) {
                await writeRow(cloudDb, l); toCloud++;
            } else if (c) {
                await writeRow(localDb, c); toLocal++;
            }
        } catch (e) {
            // Ignored
        }
    }

    return { toCloud, toLocal };
}

// =========================================================================
// 7. START ENGINE SINKRONISASI
// =========================================================================
async function startSync() {
    const dbHost = process.env.DB_HOST || '';
    if (!process.env.CLOUD_DB_HOST || dbHost.includes('aivencloud') || dbHost.includes('tidbcloud')) {
        console.log("ℹ️ Sinkronisasi XAMPP <-> Cloud dilewati (server ini memakai database Cloud langsung).");
        return;
    }

    console.log("==================================================");
    console.log("🚀 SINKRONISASI DUA ARAH SEMUA TABEL AKTIF (LOKAL 🔁 CLOUD)");
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

            // Auto-check schemas
            await ensureAllSyncSchemas(localDb);
            await ensureAllSyncSchemas(cloudDb);

            const now = new Date().toLocaleString();
            console.log(`[${now}] Memulai sinkronisasi otomatis semua tabel...`);

            // Step 1: Karyawan (Dua Arah)
            const kInfo = await syncKaryawanTwoWay(localDb, cloudDb);

            // Step 2: Absensi (Dua Arah)
            const aInfo = await syncAbsensiTwoWay(localDb, cloudDb);

            // Step 3: Akun Pegawai (Dua Arah)
            const apInfo = await syncAkunPegawaiTwoWay(localDb, cloudDb);

            // Step 4: Req Ubah Password (Dua Arah)
            const rInfo = await syncReqUbahPasswordTwoWay(localDb, cloudDb);

            // Step 5: Akses Scan Portal (Dua Arah)
            const aspInfo = await syncAksesScanPortalTwoWay(localDb, cloudDb);

            console.log(`✅ Sinkronisasi sukses!
   * Karyawan: ${kInfo.toCloud} ➔ Cloud, ${kInfo.toLocal} ➔ Lokal (Hapus: ${kInfo.delCloud} Cloud / ${kInfo.delLocal} Lokal)
   * Absensi: ${aInfo.toCloud} ➔ Cloud, ${aInfo.toLocal} ➔ Lokal (Hapus: ${aInfo.delCloud} Cloud / ${aInfo.delLocal} Lokal)
   * Akun Pegawai: ${apInfo.toCloud} ➔ Cloud, ${apInfo.toLocal} ➔ Lokal
   * Req Password: ${rInfo.toCloud} ➔ Cloud, ${rInfo.toLocal} ➔ Lokal
   * Jadwal Scan: ${aspInfo.toCloud} ➔ Cloud, ${aspInfo.toLocal} ➔ Lokal`);

        } catch (error) {
            console.error(`❌ Gagal Sinkronisasi:`, error.message);
        } finally {
            if (localDb) await localDb.end().catch(() => {});
            if (cloudDb) await cloudDb.end().catch(() => {});
            isSyncing = false;
        }
    };

    // Jalankan segera saat server start
    runSync();

    // Looping setiap 1 Menit (60.000 ms)
    setInterval(runSync, 60000);
}

startSync();
