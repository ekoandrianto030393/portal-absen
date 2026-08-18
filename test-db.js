const mysql = require('mysql2');
const conn = mysql.createConnection({host:'localhost', user:'root', password:'', database:'biometrik_absensi_wajah_db'});
const sql = `
SELECT 
    k.id_karyawan,
    (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-08' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
    COUNT(a.jam_masuk) AS total_masuk,
    COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR') THEN 1 ELSE 0 END), 0) AS libur_count,
    GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-08' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COUNT(a.jam_masuk) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR') THEN 1 ELSE 0 END), 0)) AS alpa_new,
    GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-08' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COUNT(a.jam_masuk) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI') THEN 1 ELSE 0 END), 0)) AS alpa_old
FROM karyawan k
LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = '2026-08'
WHERE k.id_karyawan = 'A91'
GROUP BY k.id_karyawan;
`;
conn.query(sql, (e,r)=>{
    console.log('Res:', r);
    process.exit(0);
});
