const mysql = require('mysql2');
const q = `DELETE FROM absensi WHERE tanggal >= '2026-09-24'`;

function run() { 
  const cloud = mysql.createConnection({
    host: 'mysql-25c30b1e-portal-absen.d.aivencloud.com', 
    port: 15196, 
    user: 'avnadmin', 
    password: 'AVNS_Rwsb8USmPTv2lzku1R6', 
    database: 'defaultdb', 
    ssl: {rejectUnauthorized: false}
  }); 
  
  cloud.query(q, (ec, rc) => { 
    if (ec) {
      console.error('Error saat menghapus:', ec);
    } else {
      console.log('Berhasil menghapus data dummy. Detail:', rc);
    }
    cloud.end(); 
  }); 
} 
run();
