const mysql = require('mysql2');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Assuming empty password for local dev
    database: 'biometrik'
});

pool.query("DESCRIBE view_absensi_harian;", (err, results) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(results, null, 2));
    process.exit();
});
