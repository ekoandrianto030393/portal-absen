const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        console.log('🔌 Menghubungkan ke MySQL...');
        
        const dbName = process.env.DB_NAME || 'biometrik_absensi_wajah_db';
        const dbHost = process.env.DB_HOST || '127.0.0.1';
        const dbUser = process.env.DB_USER || 'root';
        const dbPass = process.env.DB_PASS || '';

        // 1. Koneksi awal (tanpa database spesifik)
        const connection = await mysql.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPass
        });

        // 2. Buat Database jika belum ada
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Database "${dbName}" terdeteksi/dibuat.`);

        // 3. Pindah ke database tersebut
        await connection.changeUser({ database: dbName });

        // 4. Buat Tabel Karyawan
        await connection.query(`
            CREATE TABLE IF NOT EXISTS karyawan (
                id_karyawan VARCHAR(50) PRIMARY KEY,
                nama VARCHAR(100) NOT NULL,
                jabatan VARCHAR(50),
                face_descriptor JSON,
                foto LONGBLOB
            )
        `);
        console.log('✅ Tabel "karyawan" siap.');

        // 5. Buat Tabel Absensi
        await connection.query(`
            CREATE TABLE IF NOT EXISTS absensi (
                id_absensi INT AUTO_INCREMENT PRIMARY KEY,
                id_karyawan VARCHAR(50),
                tanggal DATE,
                jam_masuk TIME,
                jam_keluar TIME,
                status VARCHAR(50),
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabel "absensi" siap.');

        console.log('\n🎉 SETUP BERHASIL! Silakan jalankan ulang "node server.js"');
        process.exit();

    } catch (error) {
        console.error('\n❌ ERROR SETUP:', error.message);
        process.exit(1);
    }
})();