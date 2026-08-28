const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    console.log("=== MEMULAI MIGRASI DATABASE (XAMPP -> AIVEN) ===");

    // 1. Koneksi ke Lokal (XAMPP)
    const localDb = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'biometrik_absensi_wajah_db',
        dateStrings: true,
        timezone: '+07:00'
    });
    console.log("✅ Terhubung ke Database Lokal (XAMPP)");

    // 2. Koneksi ke Aiven
    const aivenDb = await mysql.createConnection({
        host: 'mysql-25c30b1e-portal-absen.d.aivencloud.com',
        port: 15196,
        user: 'avnadmin',
        password: 'AVNS_Rwsb8USmPTv2lzku1R6',
        database: 'defaultdb',
        ssl: { rejectUnauthorized: false },
        dateStrings: true,
        timezone: '+07:00'
    });
    console.log("✅ Terhubung ke Database Aiven (Cloud)");

    try {
        console.log("Membangun struktur tabel di Aiven...");
        
        // Buat tabel satu per satu di Aiven (sesuai struktur skema_final)
        await aivenDb.query(`DROP VIEW IF EXISTS view_absensi_harian;`);
        await aivenDb.query(`DROP VIEW IF EXISTS view_rekap_bulanan;`);
        await aivenDb.query(`DROP TABLE IF EXISTS akun_pegawai;`);
        await aivenDb.query(`DROP TABLE IF EXISTS absensi;`);
        await aivenDb.query(`DROP TABLE IF EXISTS karyawan;`);

        await aivenDb.query(`
            CREATE TABLE karyawan (
                id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
                nama VARCHAR(100) NOT NULL,
                jabatan VARCHAR(50),
                face_descriptor LONGTEXT NOT NULL,
                foto LONGBLOB,
                tanggal_registrasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Tabel 'karyawan' terbuat di Aiven");

        await aivenDb.query(`
            CREATE TABLE absensi (
                id_absensi INT AUTO_INCREMENT PRIMARY KEY,
                id_karyawan VARCHAR(50) NOT NULL,
                tanggal DATE NOT NULL,
                jam_masuk TIME NULL,
                jam_keluar TIME NULL,
                status VARCHAR(50),
                keterangan VARCHAR(255),
                telat_menit INT DEFAULT 0,
                psw_menit INT DEFAULT 0,
                UNIQUE KEY unique_absensi_harian (id_karyawan, tanggal),
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            );
        `);
        console.log("✅ Tabel 'absensi' terbuat di Aiven");

        await aivenDb.query(`
            CREATE TABLE akun_pegawai (
                id_akun INT AUTO_INCREMENT PRIMARY KEY,
                id_karyawan VARCHAR(50) NOT NULL,
                username VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            );
        `);
        console.log("✅ Tabel 'akun_pegawai' terbuat di Aiven");

        // MEMBUAT VIEWS
        const viewRekapBulanan = `
            CREATE OR REPLACE VIEW view_rekap_bulanan AS
            SELECT 
                k.id_karyawan,
                k.nama,
                k.jabatan,
                m.periode,
                COUNT(a.jam_masuk) AS total_masuk,
                SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END) AS total_dl,
                GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = m.periode AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COUNT(a.jam_masuk) - SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR') THEN 1 ELSE 0 END)) AS alpa,
                SUM(CASE WHEN a.telat_menit > 0 THEN 1 ELSE 0 END) AS telat_kali,
                COALESCE(SUM(a.telat_menit), 0) AS telat_menit,
                SUM(CASE WHEN a.psw_menit > 0 THEN 1 ELSE 0 END) AS psw_kali,
                COALESCE(SUM(a.psw_menit), 0) AS psw_menit,
                (COALESCE(SUM(a.telat_menit), 0) + COALESCE(SUM(a.psw_menit), 0)) AS total_pelanggaran_menit,
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END) AS tanpa_absen_pulang,
                SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan NOT LIKE '%Otomatis%') THEN 1 ELSE 0 END) AS pulang_kali,
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END) AS potongan_jam,
                SEC_TO_TIME(SUM(
                    CASE 
                        WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar)
                        WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, '14:00:00')) 
                        ELSE 0 
                    END
                )) AS total_jam_kerja
            FROM karyawan k
            CROSS JOIN (
                SELECT DATE_FORMAT(tanggal, '%Y-%m') AS periode, COUNT(DISTINCT tanggal) AS total_hari_kerja
                FROM absensi
                GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
            ) m
            LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = m.periode
            GROUP BY k.id_karyawan, k.nama, k.jabatan, m.periode, m.total_hari_kerja;
        `;
        await aivenDb.query(viewRekapBulanan);

        const viewAbsensiHarian = `
            CREATE OR REPLACE VIEW view_absensi_harian AS
            SELECT 
                a.id_absensi,
                k.id_karyawan,
                k.nama AS nama_karyawan,
                k.jabatan,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status,
                a.keterangan,
                a.telat_menit,
                a.psw_menit
            FROM absensi a
            JOIN karyawan k ON a.id_karyawan = k.id_karyawan
            ORDER BY a.tanggal DESC, a.jam_masuk DESC;
        `;
        await aivenDb.query(viewAbsensiHarian);
        console.log("✅ Views terbuat di Aiven");

        // === TRANSFER DATA KARYAWAN ===
        console.log("Memulai transfer data karyawan...");
        const [karyawanList] = await localDb.query('SELECT * FROM karyawan');
        for (const k of karyawanList) {
            await aivenDb.query(
                'INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto, tanggal_registrasi) VALUES (?, ?, ?, ?, ?, ?)',
                [k.id_karyawan, k.nama, k.jabatan, k.face_descriptor, k.foto, k.tanggal_registrasi]
            );
        }
        console.log("✅ Berhasil mentransfer " + karyawanList.length + " karyawan");

        // === TRANSFER DATA ABSENSI ===
        console.log("Memulai transfer data absensi...");
        const [absensiList] = await localDb.query('SELECT * FROM absensi');
        for (const a of absensiList) {
            await aivenDb.query(
                'INSERT INTO absensi (id_absensi, id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [a.id_absensi, a.id_karyawan, a.tanggal, a.jam_masuk, a.jam_keluar, a.status, a.keterangan, a.telat_menit, a.psw_menit]
            );
        }
        console.log("✅ Berhasil mentransfer " + absensiList.length + " rekam absensi");

        // === TRANSFER DATA AKUN PEGAWAI ===
        console.log("Memulai transfer data akun pegawai...");
        // Cek dulu apakah tabel akun_pegawai ada isinya di lokal
        try {
            const [akunList] = await localDb.query('SELECT * FROM akun_pegawai');
            for (const ak of akunList) {
                await aivenDb.query(
                    'INSERT INTO akun_pegawai (id_akun, id_karyawan, username, password, created_at) VALUES (?, ?, ?, ?, ?)',
                    [ak.id_akun, ak.id_karyawan, ak.username, ak.password, ak.created_at]
                );
            }
            console.log("✅ Berhasil mentransfer " + akunList.length + " akun pegawai");
        } catch(e) {
            console.log("⚠️ Tabel akun_pegawai kosong atau tidak ada di lokal, di-skip.");
        }

        console.log("🎉 SEMUA DATA BERHASIL DIMIGRASI KE AIVEN!");

    } catch (err) {
        console.error("❌ Terjadi Error saat migrasi:", err);
    } finally {
        await localDb.end();
        await aivenDb.end();
    }
}

migrate();
