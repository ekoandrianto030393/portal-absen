const mysql = require('mysql2');
const q = `SELECT k.nama, 
(SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-09' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja, 
COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) AS total_masuk, 
COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0) AS total_isc, 
GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-09' AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0)) AS alpa 
FROM karyawan k LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = '2026-09' WHERE k.nama LIKE '%WARTINI%' GROUP BY k.id_karyawan`;

function run() { 
  const local = mysql.createConnection({host:'127.0.0.1', user:'root', password:'', database:'biometrik_absensi_wajah_db'}); 
  local.query(q, (e, r) => { 
    if (e) console.error('Lokal error:', e);
    console.log('Lokal:', r); 
    local.end(); 
    
    const cloud = mysql.createConnection({host:'mysql-25c30b1e-portal-absen.d.aivencloud.com', port:15196, user:'avnadmin', password:'AVNS_Rwsb8USmPTv2lzku1R6', database:'defaultdb', ssl: {rejectUnauthorized: false}}); 
    cloud.query(q, (ec, rc) => { 
      if (ec) console.error('Cloud error:', ec);
      console.log('Cloud:', rc); 
      cloud.end(); 
    }); 
  }); 
} 
run();
