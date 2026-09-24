const mysql = require('mysql2');
const q = `SELECT * FROM absensi WHERE tanggal IN ('2026-09-23', '2026-09-24', '2026-09-25')`;

function run() { 
  const cloud = mysql.createConnection({host:'mysql-25c30b1e-portal-absen.d.aivencloud.com', port:15196, user:'avnadmin', password:'AVNS_Rwsb8USmPTv2lzku1R6', database:'defaultdb', ssl: {rejectUnauthorized: false}}); 
  cloud.query(q, (ec, rc) => { 
    if (ec) console.error('Cloud error:', ec);
    console.log('Cloud Future Records:', rc); 
    cloud.end(); 
  }); 
} 
run();
