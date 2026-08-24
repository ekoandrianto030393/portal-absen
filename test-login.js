const mysql = require('mysql2');
const pool = mysql.createPool({host:'localhost', user:'root', password:'', database:'biometrik_absensi_wajah_db'});
const sql = `
    SELECT a.id_karyawan, a.username, k.nama, k.jabatan 
    FROM akun_pegawai a 
    JOIN karyawan k ON a.id_karyawan = k.id_karyawan 
    WHERE a.username = 'ekoaja'
`;
pool.query(sql, (e,r)=>{
    console.log("Result for ekoaja:", r);
    process.exit(0);
});
