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

    // 4b. Permintaan Jadwal Libur & Dinas Luar (DL)
    await db.query(`
        CREATE TABLE IF NOT EXISTS permintaan_jadwal_libur (
            id INT AUTO_INCREMENT PRIMARY KEY,
            kode_permintaan VARCHAR(80) NOT NULL UNIQUE,
            id_karyawan VARCHAR(50) NOT NULL,
            nama VARCHAR(150) DEFAULT '',
            jabatan VARCHAR(150) DEFAULT '',
            jenis_pengajuan VARCHAR(20) NOT NULL DEFAULT 'LIBUR',
            tanggal_diajukan DATE NOT NULL,
            hari_diajukan VARCHAR(20) NOT NULL DEFAULT '',
            tahun_diajukan INT NOT NULL,
            jam_masuk VARCHAR(10) DEFAULT NULL,
            jam_pulang VARCHAR(10) DEFAULT NULL,
            keterangan TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            catatan_admin VARCHAR(255) DEFAULT NULL,
            tanggal_kirim DATETIME NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_jl_emp (id_karyawan),
            INDEX idx_jl_tgl (tanggal_diajukan),
            INDEX idx_jl_status (status)
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS permintaan_jadwal_libur_deleted (
            kode_permintaan VARCHAR(80) PRIMARY KEY,
            deleted_at DATETIME NOT NULL
        )
    `);

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

// 6. Sinkronisasi Dua Arah Catatan Kehadiran (Mobilitas Pegawai)
async function syncCatatanKehadiranTwoWay(localDb, cloudDb) {
    // A. Sinkronisasi Penghapusan (Tombstones)
    try {
        const [localDels] = await localDb.query("SELECT id_catatan FROM catatan_kehadiran_deleted");
        for (const d of localDels) {
            await cloudDb.query("DELETE FROM catatan_kehadiran WHERE id_catatan = ?", [d.id_catatan]);
            await cloudDb.query("INSERT IGNORE INTO catatan_kehadiran_deleted (id_catatan) VALUES (?)", [d.id_catatan]);
        }
        const [cloudDels] = await cloudDb.query("SELECT id_catatan FROM catatan_kehadiran_deleted");
        for (const d of cloudDels) {
            await localDb.query("DELETE FROM catatan_kehadiran WHERE id_catatan = ?", [d.id_catatan]);
            await localDb.query("INSERT IGNORE INTO catatan_kehadiran_deleted (id_catatan) VALUES (?)", [d.id_catatan]);
        }
    } catch (e) {
        // Abaikan jika tabel tombstone belum siap
    }

    // B. Dua Arah berdasarkan updated_at
    const selRows = `
        SELECT id_catatan, id_karyawan,
               DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal,
               tipe_pola, jam_masuk, jam_keluar_sementara, jam_kembali, jam_pulang, keterangan, dicatat_oleh,
               UNIX_TIMESTAMP(updated_at) AS ts
        FROM catatan_kehadiran`;
    const [localRows] = await localDb.query(selRows);
    const [cloudRows] = await cloudDb.query(selRows);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const keyOf = (r) => `${norm(r.id_karyawan)}|${r.tanggal}|${r.id_catatan}`;

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
                        `UPDATE catatan_kehadiran SET tipe_pola=?, jam_masuk=?, jam_keluar_sementara=?, jam_kembali=?, jam_pulang=?, keterangan=?, dicatat_oleh=?, updated_at=FROM_UNIXTIME(?) WHERE id_catatan=?`,
                        [l.tipe_pola, l.jam_masuk, l.jam_keluar_sementara, l.jam_kembali, l.jam_pulang, l.keterangan, l.dicatat_oleh, l.ts, c.id_catatan]
                    );
                    toCloud++;
                } else if (c.ts > l.ts) {
                    await localDb.query(
                        `UPDATE catatan_kehadiran SET tipe_pola=?, jam_masuk=?, jam_keluar_sementara=?, jam_kembali=?, jam_pulang=?, keterangan=?, dicatat_oleh=?, updated_at=FROM_UNIXTIME(?) WHERE id_catatan=?`,
                        [c.tipe_pola, c.jam_masuk, c.jam_keluar_sementara, c.jam_kembali, c.jam_pulang, c.keterangan, c.dicatat_oleh, c.ts, l.id_catatan]
                    );
                    toLocal++;
                }
            } else if (l) {
                await cloudDb.query(
                    `INSERT INTO catatan_kehadiran (id_catatan, id_karyawan, tanggal, tipe_pola, jam_masuk, jam_keluar_sementara, jam_kembali, jam_pulang, keterangan, dicatat_oleh, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
                     ON DUPLICATE KEY UPDATE tipe_pola=VALUES(tipe_pola), jam_masuk=VALUES(jam_masuk), jam_keluar_sementara=VALUES(jam_keluar_sementara), jam_kembali=VALUES(jam_kembali), jam_pulang=VALUES(jam_pulang), keterangan=VALUES(keterangan), dicatat_oleh=VALUES(dicatat_oleh), updated_at=VALUES(updated_at)`,
                    [l.id_catatan, l.id_karyawan, l.tanggal, l.tipe_pola, l.jam_masuk, l.jam_keluar_sementara, l.jam_kembali, l.jam_pulang, l.keterangan, l.dicatat_oleh, l.ts]
                );
                toCloud++;
            } else if (c) {
                await localDb.query(
                    `INSERT INTO catatan_kehadiran (id_catatan, id_karyawan, tanggal, tipe_pola, jam_masuk, jam_keluar_sementara, jam_kembali, jam_pulang, keterangan, dicatat_oleh, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
                     ON DUPLICATE KEY UPDATE tipe_pola=VALUES(tipe_pola), jam_masuk=VALUES(jam_masuk), jam_keluar_sementara=VALUES(jam_keluar_sementara), jam_kembali=VALUES(jam_kembali), jam_pulang=VALUES(jam_pulang), keterangan=VALUES(keterangan), dicatat_oleh=VALUES(dicatat_oleh), updated_at=VALUES(updated_at)`,
                    [c.id_catatan, c.id_karyawan, c.tanggal, c.tipe_pola, c.jam_masuk, c.jam_keluar_sementara, c.jam_kembali, c.jam_pulang, c.keterangan, c.dicatat_oleh, c.ts]
                );
                toLocal++;
            }
        } catch (e) {
            // Ignored
        }
    }
    return { toCloud, toLocal };
}

async function syncPermintaanJadwalLiburTwoWay(localDb, cloudDb) {
    let toCloud = 0;
    let toLocal = 0;

    // 1. Sinkronkan tombstone hapus dua arah
    const [localDel] = await localDb.query(
        "SELECT kode_permintaan, DATE_FORMAT(deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at FROM permintaan_jadwal_libur_deleted"
    );
    const [cloudDel] = await cloudDb.query(
        "SELECT kode_permintaan, DATE_FORMAT(deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at FROM permintaan_jadwal_libur_deleted"
    );

    const localDelMap = new Map(localDel.map(r => [r.kode_permintaan, r.deleted_at]));
    const cloudDelMap = new Map(cloudDel.map(r => [r.kode_permintaan, r.deleted_at]));
    const deletedSet = new Set([...localDelMap.keys(), ...cloudDelMap.keys()]);

    for (const [kode, delAt] of cloudDelMap.entries()) {
        if (!localDelMap.has(kode)) {
            await localDb.query('INSERT IGNORE INTO permintaan_jadwal_libur_deleted (kode_permintaan, deleted_at) VALUES (?, ?)', [kode, delAt]);
        }
        await localDb.query('DELETE FROM permintaan_jadwal_libur WHERE kode_permintaan = ?', [kode]);
    }
    for (const [kode, delAt] of localDelMap.entries()) {
        if (!cloudDelMap.has(kode)) {
            await cloudDb.query('INSERT IGNORE INTO permintaan_jadwal_libur_deleted (kode_permintaan, deleted_at) VALUES (?, ?)', [kode, delAt]);
        }
        await cloudDb.query('DELETE FROM permintaan_jadwal_libur WHERE kode_permintaan = ?', [kode]);
    }

    // 2. Ambil semua data permintaan dari Lokal & Cloud
    const selectSql = `
        SELECT kode_permintaan, id_karyawan, nama, jabatan, jenis_pengajuan,
               DATE_FORMAT(tanggal_diajukan, '%Y-%m-%d') AS tanggal_diajukan,
               hari_diajukan, tahun_diajukan, jam_masuk, jam_pulang, keterangan,
               status, catatan_admin,
               DATE_FORMAT(tanggal_kirim, '%Y-%m-%d %H:%i:%s') AS tanggal_kirim,
               DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM permintaan_jadwal_libur
    `;
    const [localRows] = await localDb.query(selectSql);
    const [cloudRows] = await cloudDb.query(selectSql);

    const localMap = new Map(localRows.map(r => [r.kode_permintaan, r]));
    const cloudMap = new Map(cloudRows.map(r => [r.kode_permintaan, r]));
    const allKodes = new Set([...localMap.keys(), ...cloudMap.keys()]);

    const upsertSql = `
        INSERT INTO permintaan_jadwal_libur
            (kode_permintaan, id_karyawan, nama, jabatan, jenis_pengajuan, tanggal_diajukan,
             hari_diajukan, tahun_diajukan, jam_masuk, jam_pulang, keterangan, status,
             catatan_admin, tanggal_kirim, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nama = VALUES(nama),
            jabatan = VALUES(jabatan),
            jenis_pengajuan = VALUES(jenis_pengajuan),
            tanggal_diajukan = VALUES(tanggal_diajukan),
            hari_diajukan = VALUES(hari_diajukan),
            tahun_diajukan = VALUES(tahun_diajukan),
            jam_masuk = VALUES(jam_masuk),
            jam_pulang = VALUES(jam_pulang),
            keterangan = VALUES(keterangan),
            status = VALUES(status),
            catatan_admin = VALUES(catatan_admin),
            tanggal_kirim = VALUES(tanggal_kirim),
            updated_at = VALUES(updated_at)
    `;

    const toParams = (r) => [
        r.kode_permintaan, r.id_karyawan, r.nama || '', r.jabatan || '',
        r.jenis_pengajuan || 'LIBUR', r.tanggal_diajukan,
        r.hari_diajukan || '', Number(r.tahun_diajukan || String(r.tanggal_diajukan || '').slice(0, 4) || 2026),
        r.jam_masuk || null, r.jam_pulang || null, r.keterangan || '',
        r.status || 'pending', r.catatan_admin || null,
        r.tanggal_kirim, r.updated_at || r.tanggal_kirim
    ];

    const toEpoch = (dtStr) => {
        if (!dtStr) return 0;
        const ms = new Date(String(dtStr).replace(' ', 'T') + '+07:00').getTime();
        return isNaN(ms) ? 0 : ms;
    };

    for (const kode of allKodes) {
        if (deletedSet.has(kode)) {
            await localDb.query('DELETE FROM permintaan_jadwal_libur WHERE kode_permintaan = ?', [kode]);
            await cloudDb.query('DELETE FROM permintaan_jadwal_libur WHERE kode_permintaan = ?', [kode]);
            continue;
        }
        const l = localMap.get(kode);
        const c = cloudMap.get(kode);
        if (c && !l) {
            await localDb.query(upsertSql, toParams(c));
            toLocal++;
        } else if (l && !c) {
            await cloudDb.query(upsertSql, toParams(l));
            toCloud++;
        } else if (l && c) {
            const lMs = toEpoch(l.updated_at);
            const cMs = toEpoch(c.updated_at);
            if (cMs > lMs) {
                await localDb.query(upsertSql, toParams(c));
                toLocal++;
            } else if (lMs > cMs) {
                await cloudDb.query(upsertSql, toParams(l));
                toCloud++;
            } else if (l.status !== c.status) {
                if (c.status !== 'pending' && l.status === 'pending') {
                    await localDb.query(upsertSql, toParams(c));
                    toLocal++;
                } else if (l.status !== 'pending' && c.status === 'pending') {
                    await cloudDb.query(upsertSql, toParams(l));
                    toCloud++;
                }
            }
        }
    }

    return { toCloud, toLocal };
}

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

            // Step 6: Catatan Kehadiran (Dua Arah)
            const cInfo = await syncCatatanKehadiranTwoWay(localDb, cloudDb);

            // Step 7: Permintaan Jadwal Libur & DL (Dua Arah)
            const jlInfo = await syncPermintaanJadwalLiburTwoWay(localDb, cloudDb);
            if (jlInfo.toCloud > 0 || jlInfo.toLocal > 0) {
                console.log(`   📅 Jadwal Libur/DL Sync: Cloud+${jlInfo.toCloud} / Local+${jlInfo.toLocal}`);
            }

            console.log(`✅ Sinkronisasi sukses!
   * Karyawan: ${kInfo.toCloud} ➔ Cloud, ${kInfo.toLocal} ➔ Lokal (Hapus: ${kInfo.delCloud} Cloud / ${kInfo.delLocal} Lokal)
   * Absensi: ${aInfo.toCloud} ➔ Cloud, ${aInfo.toLocal} ➔ Lokal (Hapus: ${aInfo.delCloud} Cloud / ${aInfo.delLocal} Lokal)
   * Akun Pegawai: ${apInfo.toCloud} ➔ Cloud, ${apInfo.toLocal} ➔ Lokal
   * Req Password: ${rInfo.toCloud} ➔ Cloud, ${rInfo.toLocal} ➔ Lokal
   * Jadwal Scan: ${aspInfo.toCloud} ➔ Cloud, ${aspInfo.toLocal} ➔ Lokal
   * Catatan Kehadiran: ${cInfo.toCloud} ➔ Cloud, ${cInfo.toLocal} ➔ Lokal`);

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
