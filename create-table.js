const mysql = require('mysql2');
const pool = mysql.createPool({host:'localhost', user:'root', password:'', database:'biometrik_absensi_wajah_db'});
pool.query(`
CREATE TABLE IF NOT EXISTS akun_pegawai (
    id_akun INT AUTO_INCREMENT PRIMARY KEY,
    id_karyawan VARCHAR(50) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
);
`, (e,r)=>{
    if(e) console.log(e); 
    else console.log('Table created!'); 
    process.exit(0);
});
