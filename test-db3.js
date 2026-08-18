const mysql = require('mysql2');
const conn = mysql.createConnection({host:'localhost', user:'root', password:'', database:'biometrik_absensi_wajah_db'});
const sql = `
SELECT 
    k.id_karyawan,
    k.tanggal_registrasi,
    (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-08' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
    COUNT(a.jam_masuk) AS total_masuk
FROM karyawan k
LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = '2026-08'
WHERE k.id_karyawan = 'A91'
GROUP BY k.id_karyawan;
`;
conn.query(sql, (e,r)=>{
    console.log(r);
    process.exit(0);
});
