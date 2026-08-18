const mysql = require('mysql2');
const conn = mysql.createConnection({host:'localhost', user:'root', password:'', database:'biometrik_absensi_wajah_db'});
conn.query("SELECT DISTINCT tanggal FROM absensi WHERE tanggal >= '2026-08-11'", (e,r)=>{
    console.log(r);
    process.exit(0);
});
