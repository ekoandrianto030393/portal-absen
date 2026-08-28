require('dotenv').config();
const mysql = require('mysql2/promise');

async function startSync() {
    console.log("==================================================");
    console.log("🚀 SINKRONISASI OFFLINE-FIRST AKTIF (XAMPP -> AIVEN)");
    console.log("==================================================");

    // Looping terus menerus setiap 1 Menit (60.000 ms)
    setInterval(async () => {
        try {
            // 1. Koneksi ke Lokal
            const localDb = await mysql.createConnection({
                host: process.env.DB_HOST || '127.0.0.1',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASS || '',
                database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
                dateStrings: true,
                timezone: '+07:00'
            });

            // 2. Koneksi ke Cloud Aiven
            const cloudDb = await mysql.createConnection({
                host: process.env.CLOUD_DB_HOST,
                port: process.env.CLOUD_DB_PORT,
                user: process.env.CLOUD_DB_USER,
                password: process.env.CLOUD_DB_PASS,
                database: process.env.CLOUD_DB_NAME,
                ssl: { rejectUnauthorized: false },
                dateStrings: true,
                timezone: '+07:00'
            });

            const now = new Date().toLocaleString();
            console.log(`[${now}] Memulai sinkronisasi otomatis...`);

            // --- SYNC ABSENSI (7 Hari Terakhir saja agar cepat) ---
            const [absensiList] = await localDb.query(
                "SELECT * FROM absensi WHERE tanggal >= CURDATE() - INTERVAL 7 DAY"
            );
            
            let absensiSynced = 0;
            for (const a of absensiList) {
                await cloudDb.query(
                    `INSERT INTO absensi (id_absensi, id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status), 
                     keterangan = VALUES(keterangan), telat_menit = VALUES(telat_menit), psw_menit = VALUES(psw_menit)`,
                    [a.id_absensi, a.id_karyawan, a.tanggal, a.jam_masuk, a.jam_keluar, a.status, a.keterangan, a.telat_menit, a.psw_menit]
                );
                absensiSynced++;
            }

            // --- SYNC KARYAWAN (Jika ada pegawai baru/update foto) ---
            const [karyawanList] = await localDb.query("SELECT * FROM karyawan");
            for (const k of karyawanList) {
                await cloudDb.query(
                    `INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto, tanggal_registrasi) 
                     VALUES (?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     nama = VALUES(nama), jabatan = VALUES(jabatan), face_descriptor = VALUES(face_descriptor), foto = VALUES(foto)`,
                    [k.id_karyawan, k.nama, k.jabatan, k.face_descriptor, k.foto, k.tanggal_registrasi]
                );
            }

            // --- SYNC AKUN ---
            try {
                const [akunList] = await localDb.query("SELECT * FROM akun_pegawai");
                for (const ak of akunList) {
                    await cloudDb.query(
                        `INSERT INTO akun_pegawai (id_akun, id_karyawan, username, password, created_at) 
                         VALUES (?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE 
                         username = VALUES(username), password = VALUES(password)`,
                        [ak.id_akun, ak.id_karyawan, ak.username, ak.password, ak.created_at]
                    );
                }
            } catch (e) {
                // Ignore if table doesn't exist
            }

            // --- SYNC REQ UBAH PASSWORD (AIVEN <-> XAMPP) ---
            try {
                // 1. Tarik permintaan 'pending' dari Cloud (Aiven) ke Lokal (XAMPP)
                const [reqPendingCloud] = await cloudDb.query("SELECT * FROM req_ubah_password WHERE status = 'pending'");
                for (const r of reqPendingCloud) {
                    await localDb.query(
                        `INSERT INTO req_ubah_password (id_req, id_karyawan, password_baru, status, created_at) 
                         VALUES (?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                        [r.id_req, r.id_karyawan, r.password_baru, r.status, r.created_at]
                    );
                }

                // 2. Kirim status yang sudah 'approved'/'rejected' dari Lokal (XAMPP) ke Cloud (Aiven)
                const [reqSelesaiLokal] = await localDb.query("SELECT * FROM req_ubah_password WHERE status IN ('approved', 'rejected')");
                for (const r of reqSelesaiLokal) {
                    await cloudDb.query(
                        `UPDATE req_ubah_password SET status = ? WHERE id_req = ?`,
                        [r.status, r.id_req]
                    );
                }
            } catch (e) {
                // Ignore if table doesn't exist yet
            }

            console.log(`✅ Sinkronisasi sukses! (${absensiSynced} data absen ter-update ke Cloud)`);

            await localDb.end();
            await cloudDb.end();

        } catch (error) {
            console.error(`❌ Gagal Sinkronisasi (Mungkin internet terputus):`, error.message);
        }

    }, 60000); // 60.000 ms = 1 Menit
}

startSync();
