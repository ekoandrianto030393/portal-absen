// Muat konfigurasi dari file .env
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

// --- KONFIGURASI JAM OPERASIONAL (Bisa disesuaikan) ---
const JAM_MASUK_START      = process.env.JAM_MASUK_START      || '06:00:00';
const JAM_MASUK_END        = process.env.JAM_MASUK_END        || '12:00:00';
const JAM_PULANG_START     = process.env.JAM_PULANG_START     || '16:00:00';
const JAM_PULANG_JUMAT     = process.env.JAM_PULANG_JUMAT     || '12:00:00'; // Khusus Hari Jumat
const JAM_KERJA_MULAI      = process.env.JAM_KERJA_MULAI      || '08:00:00'; // Jam resmi masuk
const BATAS_TELAT          = process.env.BATAS_TELAT          || '08:25:00'; // Toleransi telat
const POTONGAN_LUPA_PULANG = process.env.POTONGAN_LUPA_PULANG || 2;          // Jam potongan
const AUTO_PULANG_DEFAULT  = process.env.AUTO_PULANG_DEFAULT  || '14:00:00'; // Jam pulang default

// Middleware untuk parsing JSON body (limit besar untuk upload foto)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Endpoint khusus untuk mencegah error 404 favicon.ico di browser
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve file statis (HTML, CSS, JS) dari folder yang sama
app.use(express.static(path.join(__dirname, '.')));

// Middleware CORS Manual (Agar tidak error saat diakses dari Live Server/Port berbeda)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Konfigurasi Database menggunakan POOL (Lebih stabil daripada createConnection)
// Pool akan otomatis menyambung ulang jika koneksi putus (wait_timeout)
const pool = mysql.createPool({
    host: '127.0.0.1', // Gunakan IP 127.0.0.1 agar lebih stabil di Windows
    user: 'root',
    password: '',      // Default XAMPP kosong
    database: 'biometrik_absensi_wajah_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Cek Koneksi Database saat Startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal koneksi ke Database MySQL:', err.message);
        console.log('💡 Pastikan XAMPP MySQL sudah di-Start!');
    } else {
        console.log('✅ Terkoneksi ke Database MySQL (Pool)');
        console.log('📋 Konfigurasi Absensi (dari .env):');
        console.log(`   - Batas Telat: ${BATAS_TELAT}`);
        console.log(`   - Potongan Lupa Pulang: ${POTONGAN_LUPA_PULANG} Jam`);
        console.log(`   - Auto Pulang Default: ${AUTO_PULANG_DEFAULT}`);
        console.log(`   - Jam Pulang Jumat: ${JAM_PULANG_JUMAT}`);
        
        // --- SINKRONISASI SKEMA DATABASE (Berdasarkan skema_final.sql) ---
        
        // 0. Bersihkan View Lama (Sesuai skema_final.sql untuk mencegah error #1356)
        const cleanUpSql = `DROP VIEW IF EXISTS absensi_harian_hitung, rekap_gaji_bulanan, rekap_bulanan, view_rekap_bulanan;`;

        // 1. Tabel Karyawan
        const createKaryawanSql = `
            CREATE TABLE IF NOT EXISTS karyawan (
                id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
                nama VARCHAR(100) NOT NULL,
                jabatan VARCHAR(50),
                face_descriptor LONGTEXT NOT NULL,
                foto LONGBLOB,
                tanggal_registrasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `;

        // 2. Tabel Absensi
        const createAbsensiSql = `
            CREATE TABLE IF NOT EXISTS absensi (
                id_absensi INT AUTO_INCREMENT PRIMARY KEY,
                id_karyawan VARCHAR(50) NOT NULL,
                tanggal DATE NOT NULL,
                jam_masuk TIME NULL,
                jam_keluar TIME NULL,
                status VARCHAR(50),
                keterangan VARCHAR(255),
                UNIQUE KEY unique_absensi_harian (id_karyawan, tanggal),
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `;
        
        // 3. View Rekap Bulanan
        const createViewRekapSql = `
            CREATE OR REPLACE VIEW view_rekap_bulanan AS
            SELECT 
                k.id_karyawan,
                k.nama,
                k.jabatan,
                m.periode,
                COUNT(a.jam_masuk) AS total_masuk,
                SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END) AS total_dl,
                GREATEST(0, m.total_hari_kerja - COUNT(a.jam_masuk)) AS alpa, -- Alpa = Total Hari Kerja Nyata - Total Masuk
                SUM(CASE WHEN a.jam_masuk > '${BATAS_TELAT}' AND a.status NOT IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END) AS telat_kali,
                COALESCE(SUM(CASE WHEN a.jam_masuk > '${BATAS_TELAT}' AND a.status NOT IN ('DL', 'DINAS_LUAR') THEN FLOOR((TIME_TO_SEC(a.jam_masuk) - TIME_TO_SEC('${BATAS_TELAT}')) / 60) ELSE 0 END), 0) AS telat_menit,
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan = 'Otomatis: Lupa Absen Pulang') THEN 1 ELSE 0 END) AS tanpa_absen_pulang,
                SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan != 'Otomatis: Lupa Absen Pulang') THEN 1 ELSE 0 END) AS pulang_kali,
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan = 'Otomatis: Lupa Absen Pulang') THEN ${POTONGAN_LUPA_PULANG} ELSE 0 END) AS potongan_jam,
                SEC_TO_TIME(SUM(
                    CASE 
                        WHEN a.jam_keluar IS NOT NULL THEN (TIME_TO_SEC(a.jam_keluar) - TIME_TO_SEC(a.jam_masuk))
                        WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN GREATEST(0, (TIME_TO_SEC('${AUTO_PULANG_DEFAULT}') - TIME_TO_SEC(a.jam_masuk)))
                        ELSE 0 
                    END
                )) AS total_jam_kerja
            FROM karyawan k
            CROSS JOIN (
                SELECT DATE_FORMAT(tanggal, '%Y-%m') AS periode, COUNT(DISTINCT tanggal) AS total_hari_kerja
                FROM absensi
                GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
            ) m
            LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = m.periode
            GROUP BY k.id_karyawan, k.nama, k.jabatan, m.periode, m.total_hari_kerja;
        `;

        // 4. View Absensi Harian
        const createViewHarianSql = `
            CREATE OR REPLACE VIEW view_absensi_harian AS
            SELECT 
                a.id_absensi,
                k.id_karyawan,
                k.nama AS nama_karyawan,
                k.jabatan,
                a.tanggal,
                a.jam_masuk,
                a.jam_keluar,
                a.status
            FROM absensi a
            JOIN karyawan k ON a.id_karyawan = k.id_karyawan
            ORDER BY a.tanggal DESC, a.jam_masuk DESC;
        `;
        
        // Eksekusi Berurutan (Chained)
        connection.query(cleanUpSql, (err) => {
            if (err) console.error('⚠️ Gagal Cleanup View:', err.message);
            else {
                connection.query(createKaryawanSql, (err) => {
                    if (err) console.error('⚠️ Init Tabel Karyawan:', err.message);
                    else {
                        connection.query(createAbsensiSql, (err) => {
                            if (err) console.error('⚠️ Init Tabel Absensi:', err.message);
                            else {
                                // FIX: Pastikan kolom 'keterangan' ada sebelum membuat View (untuk database lama)
                                const addColumnSql = "ALTER TABLE absensi ADD COLUMN keterangan VARCHAR(255)";
                                connection.query(addColumnSql, (err) => {
                                    // Error 1060 = Duplicate column name (artinya kolom sudah ada, abaikan)
                                    if (err && err.errno !== 1060) console.error('⚠️ Update Schema Absensi:', err.message);

                                    connection.query(createViewRekapSql, (err) => {
                                        if (err) console.error('⚠️ Init View Rekap:', err.message);
                                        else {
                                            connection.query(createViewHarianSql, (err) => {
                                                if (err) console.error('⚠️ Init View Harian:', err.message);
                                                else console.log('✅ Database Sinkron dengan Skema Final (Tabel & View Siap).');
                                            });
                                        }
                                    });
                                });
                            }
                        });
                    }
                });
            }
        });

        connection.release();
    }
});

// Endpoint: Register Wajah (Pengganti register_face.php)
app.post('/register', (req, res) => {
    // admin.js mengirim: { id_karyawan, nama, jabatan, face_descriptor, foto }
    const { id_karyawan, nama, jabatan, face_descriptor, foto } = req.body;

    if (!id_karyawan || !nama || !face_descriptor || !foto) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // Decode Base64 Foto (Hapus prefix data:image/...)
    const base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const sql = `INSERT INTO karyawan (id_karyawan, nama, jabatan, foto, face_descriptor) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 nama = VALUES(nama), 
                 jabatan = VALUES(jabatan), 
                 foto = VALUES(foto), 
                 face_descriptor = VALUES(face_descriptor)`;

    // Gunakan pool.query
    pool.query(sql, [id_karyawan, nama, jabatan, buffer, face_descriptor], (err, result) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        console.log(`✅ Data tersimpan: ${id_karyawan} - ${nama}`);
        res.json({ success: true, message: 'Berhasil disimpan' });
    });
});

// Endpoint: API Rekap (Pengganti logika PHP untuk rekap)
app.get('/api/rekap', (req, res) => {
    let periode = req.query.periode; // Format: YYYY-MM
    
    if (!periode) {
        // Default ke bulan saat ini jika tidak ada parameter
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        periode = `${year}-${month}`;
    }

    // UPDATE: Gunakan View 'view_rekap_bulanan' sesuai skema_final.sql
    const sql = `SELECT * FROM view_rekap_bulanan WHERE periode = ?`;

    pool.query(sql, [periode], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Endpoint: API Rekap Bulanan (Khusus Dashboard Baru)
app.get('/api/rekap/bulanan', (req, res) => {
    let periode = req.query.periode;
    
    if (!periode) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        periode = `${year}-${month}`;
    }

    const sql = `SELECT * FROM view_rekap_bulanan WHERE periode = ?`;

    pool.query(sql, [periode], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// Endpoint: Data Absensi Harian (Sesuai View Baru di skema_final.sql)
app.get('/api/absensi/harian', (req, res) => {
    const sql = "SELECT * FROM view_absensi_harian LIMIT 100";
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// Endpoint: Data Absensi Hari Ini (Khusus Scan Page Diagnostic)
app.get('/api/absensi/today', (req, res) => {
    const sql = "SELECT nama_karyawan AS nama, jam_masuk AS jam FROM view_absensi_harian WHERE tanggal = CURDATE() ORDER BY jam_masuk ASC";
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json(results);
    });
});

// Endpoint: Ambil Descriptors untuk Absensi (Scan Wajah)
app.get('/api/karyawan/descriptors', (req, res) => {
    // UPDATE: Ambil data lengkap (id, jabatan, foto) agar scan.js bisa menampilkan profil
    const sql = "SELECT id_karyawan, nama, jabatan, foto, face_descriptor FROM karyawan";

    pool.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        const faces = results
            .filter(row => row.face_descriptor) // Pastikan descriptor tidak kosong
            .map(row => {
                try {
                    // Konversi Buffer foto ke Base64 agar bisa ditampilkan di frontend
                    const fotoBase64 = row.foto ? row.foto.toString('base64') : '';

                    return {
                        id_karyawan: row.id_karyawan,
                        nama: row.nama,
                        jabatan: row.jabatan,
                        foto: fotoBase64,
                        face_descriptor: JSON.parse(row.face_descriptor)
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(item => item !== null);

        // UPDATE: Bungkus dengan { success: true, descriptors: [...] } sesuai format scan.js
        res.json({ success: true, descriptors: faces });
    });
});

// Endpoint: Update Data Karyawan (Edit Nama/Jabatan)
app.put('/api/karyawan/:id', (req, res) => {
    const id = req.params.id;
    const { nama, jabatan } = req.body;

    if (!nama || !jabatan) {
        return res.status(400).json({ success: false, message: 'Nama dan Jabatan harus diisi.' });
    }

    const sql = 'UPDATE karyawan SET nama = ?, jabatan = ? WHERE id_karyawan = ?';
    pool.query(sql, [nama, jabatan, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        res.json({ success: true, message: 'Data karyawan berhasil diperbarui.' });
    });
});

// Endpoint: Hapus Karyawan (Beserta data absensinya karena CASCADE)
app.delete('/api/karyawan/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM karyawan WHERE id_karyawan = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        res.json({ success: true, message: 'Data karyawan dan absensi berhasil dihapus.' });
    });
});

// Endpoint: Catat Absensi (Agar tidak 404 saat wajah terdeteksi)
app.post('/api/absensi', (req, res) => {
    const { id_karyawan } = req.body;
    
    // UPDATE: Gunakan waktu lokal server (bukan UTC) agar tanggal akurat sesuai jam komputer
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`; // Format YYYY-MM-DD Lokal
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    
    // Cari data karyawan untuk respon balik
    pool.query('SELECT nama, jabatan FROM karyawan WHERE id_karyawan = ?', [id_karyawan], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });

        const k = results[0];
        
        // LOGIKA UTAMA: Cek apakah sudah absen hari ini?
        pool.query('SELECT * FROM absensi WHERE id_karyawan = ? AND tanggal = ?', [id_karyawan, today], (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            if (rows.length === 0) {
                // --- KASUS 1: BELUM ABSEN SAMA SEKALI -> CHECK IN ---
                
                // VALIDASI WAKTU MASUK: Cegah absen di luar jam yang ditentukan
                if (currentTime < JAM_MASUK_START || currentTime > JAM_MASUK_END) {
                    return res.json({
                        success: false,
                        message: `Absen Masuk ditolak. Waktu diizinkan: ${JAM_MASUK_START} s/d ${JAM_MASUK_END}.`,
                        nama: k.nama,
                        jabatan: k.jabatan,
                        result_code: 'OUT_OF_TIME_IN',
                        statusColor: 'red'
                    });
                }

                const insertSql = 'INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, status) VALUES (?, ?, ?, ?)';
                pool.query(insertSql, [id_karyawan, today, currentTime, 'HADIR'], (err) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    
                    res.json({
                        success: true,
                        message: `Selamat Pagi, Absensi Masuk Berhasil.`,
                        nama: k.nama,
                        jabatan: k.jabatan,
                        result_code: 'CHECK_IN_SUCCESS',
                        statusColor: 'green'
                    });
                });
            } else {
                const dataAbsen = rows[0];

                if (dataAbsen.jam_keluar) {
                    // --- KASUS 2: SUDAH PULANG -> TOLAK DUPLIKASI (WARNING) ---
                    res.json({
                        success: false, // False agar UI menampilkan warna peringatan (kuning/merah)
                        message: `Anda sudah absen pulang hari ini pada jam ${dataAbsen.jam_keluar}.`,
                        nama: k.nama,
                        jabatan: k.jabatan,
                        result_code: 'ALREADY_CHECKED_OUT',
                        statusColor: 'yellow' // Kuning = Warning (Bukan Error Fatal)
                    });
                } else {
                    // --- KASUS 3: SUDAH MASUK, BELUM PULANG -> CHECK OUT (AUTO FIX) ---
                    
                    // LOGIKA KHUSUS HARI JUMAT (Pulang lebih awal)
                    let jamPulangEfektif = JAM_PULANG_START;
                    if (now.getDay() === 5) { // 0=Minggu, 5=Jumat, 6=Sabtu
                        jamPulangEfektif = JAM_PULANG_JUMAT;
                    }

                    // VALIDASI WAKTU PULANG: Cegah pulang sebelum waktunya
                    if (currentTime < jamPulangEfektif) {
                        return res.json({
                            success: false,
                            message: `Anda sudah Absen Masuk. Absen Pulang baru dibuka jam ${jamPulangEfektif}.`,
                            nama: k.nama,
                            jabatan: k.jabatan,
                            result_code: 'TOO_EARLY_OUT',
                            statusColor: 'yellow'
                        });
                    }

                    // VALIDASI TAMBAHAN: Cegah Check-Out instan (misal < 60 detik setelah masuk)
                    // Ini mencegah user yang berdiri lama di depan kamera langsung ter-absen pulang (double scan glitch)
                    const [h, m, s] = dataAbsen.jam_masuk.split(':');
                    const waktuMasuk = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
                    const selisihDetik = (now - waktuMasuk) / 1000;

                    if (selisihDetik < 60) {
                        return res.json({
                            success: false,
                            message: `Anda baru saja Check-In. Tunggu 1 menit untuk Check-Out.`,
                            nama: k.nama,
                            jabatan: k.jabatan,
                            result_code: 'ALREADY_CHECKED_IN',
                            statusColor: 'yellow'
                        });
                    }

                    // UPDATE: Gunakan 'id_absensi' sesuai skema_final.sql
                    pool.query('UPDATE absensi SET jam_keluar = ? WHERE id_absensi = ?', [currentTime, dataAbsen.id_absensi], (err) => {
                        if (err) return res.status(500).json({ success: false, message: err.message });

                        res.json({
                            success: true,
                            message: `Hati-hati di jalan, Absensi Pulang Berhasil.`,
                            nama: k.nama,
                            jabatan: k.jabatan,
                            result_code: 'CHECK_OUT_SUCCESS',
                            statusColor: 'green'
                        });
                    });
                }
            }
        });
    });
});

// Endpoint: Input Manual Absensi (Dinas Luar / Izin / Sakit)
app.post('/api/absensi/manual', (req, res) => {
    const { id_karyawan, status, keterangan, tanggal } = req.body;

    if (!id_karyawan || !status || !tanggal) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap (ID, Status, Tanggal wajib diisi)' });
    }

    // Tentukan jam masuk/keluar otomatis jika DL agar terhitung jam kerja & tidak alpa
    let jamMasuk = null;
    let jamKeluar = null;

    if (status === 'DL') {
        jamMasuk = JAM_KERJA_MULAI;  // Isi jam masuk default (misal 08:00)
        jamKeluar = JAM_PULANG_START; // Isi jam pulang default (misal 16:00)
    }

    const sql = `INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, jam_keluar, status) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status)`;

    pool.query(sql, [id_karyawan, tanggal, jamMasuk, jamKeluar, status], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Data manual berhasil disimpan.' });
    });
});

// Endpoint: Get System Config (Agar Dashboard sinkron dengan .env)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        config: {
            jam_kerja_mulai: JAM_KERJA_MULAI, // Default 08:00:00
            batas_telat: BATAS_TELAT,         // Default 08:20:00
            jam_pulang_start: JAM_PULANG_START // Default 16:00:00
        }
    });
});

// --- SCHEDULER: AUTO FIX LUPA PULANG (Setiap 1 Jam) ---
// Menutup absensi kemarin yang masih open (Lupa Pulang) secara otomatis & aman dari duplikasi
setInterval(() => {
    const sql = `UPDATE absensi SET jam_keluar = ?, keterangan = 'Otomatis: Lupa Absen Pulang' WHERE jam_keluar IS NULL AND tanggal < CURDATE()`;
    pool.query(sql, [AUTO_PULANG_DEFAULT], (err, result) => {
        if (err) console.error('⚠️ Auto-Fix Error:', err.message);
        else if (result.affectedRows > 0) {
            console.log(`🤖 Auto-Fix: ${result.affectedRows} data absensi diperbarui (Lupa Pulang).`);
        }
    });
}, 3600000); // Cek setiap 1 jam (3600000 ms)

// Jalankan Server
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
    console.log(`📂 Buka http://localhost:${port}/admin.html di browser`);
});