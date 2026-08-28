require('dotenv').config();
const mysql = require('mysql2');
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud') ? { rejectUnauthorized: false } : undefined,
    dateStrings: ['DATE', 'DATETIME']
});

pool.on('connection', function (connection) {
    connection.query("SET time_zone = '+07:00'");
});

pool.query("DELETE FROM absensi WHERE tanggal = CURDATE()", (err, results) => {
    if (err) {
        console.error("Error menghapus data:", err.message);
    } else {
        console.log(`Berhasil menghapus ${results.affectedRows} data absensi untuk hari ini.`);
    }
    process.exit(0);
});
