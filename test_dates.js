const mysql = require('mysql2');
const q = `SELECT DISTINCT tanggal FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = '2026-09' ORDER BY tanggal ASC`;

function run() { 
  const local = mysql.createConnection({host:'127.0.0.1', user:'root', password:'', database:'biometrik_absensi_wajah_db'}); 
  local.query(q, (e, r) => { 
    if (e) console.error('Lokal error:', e);
    console.log('Lokal Dates:', r.map(row => row.tanggal.toISOString().split('T')[0])); 
    local.end(); 
    
    const cloud = mysql.createConnection({host:'mysql-25c30b1e-portal-absen.d.aivencloud.com', port:15196, user:'avnadmin', password:'AVNS_Rwsb8USmPTv2lzku1R6', database:'defaultdb', ssl: {rejectUnauthorized: false}}); 
    cloud.query(q, (ec, rc) => { 
      if (ec) console.error('Cloud error:', ec);
      console.log('Cloud Dates:', rc.map(row => row.tanggal.toISOString().split('T')[0])); 
      cloud.end(); 
    }); 
  }); 
} 
run();
