// Muat konfigurasi dari file .env
require('dotenv').config();

// --- PENCEGAH CRASH OTOMATIS (ANTI-CRASH) ---
// Mencegah server Node.js mati tiba-tiba jika ada error yang tidak terduga
process.on('uncaughtException', (err) => {
    console.error('💥 [CRITICAL ERROR] Terjadi kesalahan sistem:', err);
    console.log('🛡️ Sistem Anti-Crash aktif, server tetap berjalan...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [UNHANDLED REJECTION] Ada proses asinkron yang gagal:', reason);
    console.log('🛡️ Sistem Anti-Crash aktif, server tetap berjalan...');
});
// ------------------------------------------

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process'); // [NEW] Untuk menjalankan mysqldump
const fs = require('fs'); // [NEW] Untuk manajemen file backup

// Helper fungsi untuk hashing password pegawai
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const app = express();
const port = 3000;

// --- HELPER: TIME SANITIZER ---
// Memastikan format jam dari .env selalu HH:MM:SS (misal 7:30:00 -> 07:30:00)
// Ini PENTING agar perbandingan string waktu berfungsi benar.
const formatTime = (t) => {
    if (!t) return '00:00:00';
    const clean = t.replace(/^:/, ''); // Hapus titik dua di awal jika ada typo
    const parts = clean.split(':');
    return parts.map(p => p.padStart(2, '0')).join(':');
};

// --- KONFIGURASI JAM OPERASIONAL (Bisa disesuaikan) ---
const JAM_MASUK_START      = formatTime(process.env.JAM_MASUK_START);
const JAM_MASUK_END        = formatTime(process.env.JAM_MASUK_END);
const JAM_PULANG_START     = formatTime(process.env.JAM_PULANG_START);
const BATAS_MIN_PULANG     = formatTime(process.env.BATAS_MIN_PULANG);
const JAM_KERJA_MULAI      = formatTime(process.env.JAM_KERJA_MULAI);
const BATAS_TELAT          = formatTime(process.env.BATAS_TELAT);
const POTONGAN_LUPA_PULANG = process.env.POTONGAN_LUPA_PULANG;          // Jam potongan
const AUTO_PULANG_DEFAULT  = formatTime(process.env.AUTO_PULANG_DEFAULT);
// [NEW] Auto Pulang Khusus Hari Jumat & Sabtu (Fallback ke Default jika tidak di-set di .env)
const AUTO_PULANG_JUMAT    = process.env.AUTO_PULANG_DEFAULT_JUMAT ? formatTime(process.env.AUTO_PULANG_DEFAULT_JUMAT) : AUTO_PULANG_DEFAULT;
const AUTO_PULANG_SABTU    = process.env.AUTO_PULANG_DEFAULT_SABTU ? formatTime(process.env.AUTO_PULANG_DEFAULT_SABTU) : AUTO_PULANG_DEFAULT;
// [NEW] Jam Pulang Khusus Jumat & Sabtu (Default jika tidak ada di .env)
let JAM_PULANG_JUMAT       = formatTime(process.env.JAM_PULANG_JUMAT);
let JAM_PULANG_SABTU       = formatTime(process.env.JAM_PULANG_SABTU);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const CF_AIG_TOKEN = process.env.CF_AIG_TOKEN;
const CF_WORKER_TTS_URL = process.env.CF_WORKER_TTS_URL || 'https://biometrik-ai-worker.biometrikworkersaiaibinding.workers.dev';

// Middleware untuk parsing JSON body (limit besar untuk upload foto)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Endpoint khusus untuk mencegah error 404 favicon.ico di browser
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve file statis dengan optimasi caching untuk file model
app.use(express.static(path.join(__dirname, '.'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.bin') || filePath.endsWith('.onnx') || filePath.endsWith('.wasm')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        } else if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Middleware CORS Manual (Agar tidak error saat diakses dari Live Server/Port berbeda)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // [FIX] Cegah caching mutlak untuk semua endpoint API (Agar mobile app benar-benar real-time seperti Kotlin/React)
    if (req.path.startsWith('/api/')) {
        res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');
        res.header('Surrogate-Control', 'no-store');
    }

    // Tangani preflight request untuk PUT/DELETE
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// Konfigurasi Database menggunakan POOL (Lebih stabil daripada createConnection)
// Pool akan otomatis menyambung ulang jika koneksi putus (wait_timeout)
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
    timezone: '+07:00',
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud') ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // [FIX] Mencegah driver mengubah DATE/TIME menjadi JavaScript Date object
    // Tanpa ini, DATE '2026-06-02' → JS Date → JSON "2026-06-01T17:00:00Z" (mundur 1 hari di UTC+7)
    dateStrings: ['DATE', 'DATETIME']
});

pool.on('connection', function (connection) {
    connection.query("SET time_zone = '+07:00'");
});

// Cek Koneksi Database saat Startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal koneksi ke Database MySQL:', err.message);
        console.log('💡 Pastikan XAMPP MySQL sudah di-Start!');
    } else {
        console.log('✅ Terkoneksi ke Database MySQL (Pool)');
        
        // Mulai Layanan Sinkronisasi Offline-First (HANYA JALAN DI LAPTOP LOKAL)
        if (process.env.DB_HOST === '127.0.0.1' || process.env.DB_HOST === 'localhost') {
            require('./sync_service.js');
        } else {
            console.log('☁️ Mode Cloud Aktif: Menjalankan API untuk Portal 24 Jam (Tanpa Sync)');
        }

        console.log('📋 Konfigurasi Absensi (dari .env):');
        console.log(`   - Jam Masuk: ${JAM_MASUK_START} s/d ${JAM_MASUK_END}`);
        console.log(`   - Jam Kerja Mulai: ${JAM_KERJA_MULAI}`);
        console.log(`   - Batas Telat: ${BATAS_TELAT} (Acuan hitung telat)`);
        console.log(`   - Jam Pulang: ${JAM_PULANG_START} (Min Pulang: ${BATAS_MIN_PULANG})`);
        console.log(`   - Jam Pulang (Senin-Kamis): ${JAM_PULANG_START}`);
        console.log(`   - Jam Pulang (Jumat): ${JAM_PULANG_JUMAT}`);
        console.log(`   - Jam Pulang (Sabtu): ${JAM_PULANG_SABTU}`);
        console.log(`   - Potongan Tanpa Absen Pulang: ${POTONGAN_LUPA_PULANG} Jam (Sesuai Request)`);
        console.log(`   - Auto Pulang Default: ${AUTO_PULANG_DEFAULT} (Hitung jam kerja s/d jam ini)`);
        console.log(`   - Auto Pulang Jumat: ${AUTO_PULANG_JUMAT} ${process.env.AUTO_PULANG_DEFAULT_JUMAT ? '[CUSTOM .ENV]' : '[DEFAULT]'}`);
        console.log(`   - Auto Pulang Sabtu: ${AUTO_PULANG_SABTU} ${process.env.AUTO_PULANG_DEFAULT_SABTU ? '[CUSTOM .ENV]' : '[DEFAULT]'}`);
        console.log(`   - Fitur Grafik: /api/stats/daily-range (Aktif)`);
        console.log(`   - Status Auto-Fix: ✅ AKTIF (Reset deteksi tiap jam 00:00)`);
        console.log(`   ℹ️  Logika Tanpa Absen Pulang: Hitung jam kerja s/d ${AUTO_PULANG_DEFAULT} + Potongan ${POTONGAN_LUPA_PULANG} Jam (FIX)`);
        console.log(`   ℹ️  Logika Manual Absen: Status 'HADIR', Hitung Telat & PSW Otomatis (FIX)`);
        
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
                telat_menit INT DEFAULT 0,
                psw_menit INT DEFAULT 0,
                UNIQUE KEY unique_absensi_harian (id_karyawan, tanggal),
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `;
        
        // 2.5 Tabel Req Ubah Password
        const createReqPasswordSql = `
            CREATE TABLE IF NOT EXISTS req_ubah_password (
                id_req INT AUTO_INCREMENT PRIMARY KEY,
                id_karyawan VARCHAR(50) NOT NULL,
                password_baru VARCHAR(255) NOT NULL,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `;
        
        // 3. View Rekap Bulanan
        const createViewRekapSql = `
            CREATE OR REPLACE VIEW view_rekap_bulanan AS
            SELECT 
                k.no_urut,
                k.id_karyawan,
                k.nama,
                k.jabatan,
                m.periode,
                (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = m.periode AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
                COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) AS total_masuk,
                SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END) AS total_dl,
                SUM(CASE WHEN a.status = 'SAKIT' THEN 1 ELSE 0 END) AS total_sakit,
                SUM(CASE WHEN a.status = 'IZIN' THEN 1 ELSE 0 END) AS total_izin,
                SUM(CASE WHEN a.status = 'CUTI' THEN 1 ELSE 0 END) AS total_cuti,
                GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = m.periode AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0)) AS alpa, -- [SYNC] Logika Alpa: Total Hari Aktif - Hadir - Izin/Sakit
                SUM(CASE WHEN a.telat_menit > 0 THEN 1 ELSE 0 END) AS telat_kali,
                
                COALESCE(SUM(a.telat_menit), 0) AS telat_menit,
                
                SUM(CASE WHEN a.psw_menit > 0 THEN 1 ELSE 0 END) AS psw_kali, -- Hitung berapa kali PSW
                COALESCE(SUM(a.psw_menit), 0) AS psw_menit,
                
                (COALESCE(SUM(a.telat_menit), 0) + COALESCE(SUM(a.psw_menit), 0)) AS total_pelanggaran_menit, -- Total Menit Pelanggaran (Telat + PSW)
                
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END) AS tanpa_absen_pulang,
                SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan NOT LIKE '%Otomatis%') THEN 1 ELSE 0 END) AS pulang_kali,
                SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN ${POTONGAN_LUPA_PULANG} ELSE 0 END) AS potongan_jam,
                SEC_TO_TIME(SUM(
                    CASE 
                        WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar)
                        WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN
                            GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, 
                                CASE 
                                    WHEN DAYOFWEEK(a.tanggal) = 6 THEN '${AUTO_PULANG_JUMAT}' -- Jumat
                                    WHEN DAYOFWEEK(a.tanggal) = 7 THEN '${AUTO_PULANG_SABTU}' -- Sabtu
                                    ELSE '${AUTO_PULANG_DEFAULT}'
                                END
                            ))
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
                a.status,
                a.keterangan,
                a.telat_menit,
                a.psw_menit
            FROM absensi a
            JOIN karyawan k ON a.id_karyawan = k.id_karyawan
            ORDER BY a.tanggal DESC, (a.jam_masuk IS NULL) DESC, a.jam_masuk DESC;
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
                                connection.query(createReqPasswordSql, (err) => {
                                    if (err) console.error('⚠️ Init Tabel Req Password:', err.message);
                                    
                                    // FIX: Pastikan kolom baru ada sebelum membuat View (untuk database lama)
                                    const addColumnSql = "ALTER TABLE absensi ADD COLUMN keterangan VARCHAR(255)";
                                    const addTelatSql = "ALTER TABLE absensi ADD COLUMN telat_menit INT DEFAULT 0";
                                const addPswSql = "ALTER TABLE absensi ADD COLUMN psw_menit INT DEFAULT 0";
                                const addNoUrutSql = "ALTER TABLE karyawan ADD COLUMN no_urut INT DEFAULT 9999";

                                connection.query(addColumnSql, (err) => {
                                    // Error 1060 = Duplicate column name (artinya kolom sudah ada, abaikan)
                                    if (err && err.errno !== 1060) console.error('⚠️ Update Schema Absensi:', err.message);

                                    connection.query(addTelatSql, (err) => {
                                        if (err && err.errno !== 1060) console.error('⚠️ Info Kolom Telat:', err.message);
                                        
                                        connection.query(addPswSql, (err) => {
                                            if (err && err.errno !== 1060) console.error('⚠️ Info Kolom PSW:', err.message);

                                        connection.query(addNoUrutSql, (err) => {
                                            if (err && err.errno !== 1060) console.error('⚠️ Info Kolom No Urut:', err.message);

                                            connection.query(createViewRekapSql, (err) => {
                                                if (err) console.error('⚠️ Init View Rekap:', err.message);
                                                else {
                                                    connection.query(createViewHarianSql, (err) => {
                                                        if (err) console.error('⚠️ Init View Harian:', err.message);
                                                        else console.log('✅ Database Sinkron: View Harian & Rekap Bulanan (SYNC VERIFIED).');
                                                    });
                                                }
                                            });
                                            });
                                        });
                                    });
                                }); // closes addColumnSql
                            }); // closes createReqPasswordSql
                        } // closes else
                    }); // closes createAbsensiSql
                } // closes else
            }); // closes createKaryawanSql
        } // closes else
    }); // closes cleanUpSql

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

    // [UPDATE] Logika Multi-Descriptor: Baca dulu data lama, lalu tambahkan yang baru
    pool.query('SELECT face_descriptor FROM karyawan WHERE id_karyawan = ?', [id_karyawan], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        let descriptorList = [];
        let newDescriptor;
        
        try {
            newDescriptor = JSON.parse(face_descriptor); // Descriptor baru dari client
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Format descriptor invalid' });
        }

        if (rows.length > 0 && rows[0].face_descriptor) {
            // User sudah ada, ambil data lama
            try {
                let currentData = JSON.parse(rows[0].face_descriptor);
                
                // Cek apakah format lama (Single Array) atau baru (Array of Arrays)
                if (Array.isArray(currentData)) {
                    if (currentData.length > 0 && typeof currentData[0] === 'number') {
                        descriptorList.push(currentData); // Konversi single ke list
                    } else if (currentData.length > 0 && Array.isArray(currentData[0])) {
                        descriptorList = currentData; // Sudah format list
                    }
                }
            } catch (e) { /* Abaikan error parse, mulai dari kosong */ }
        }

        // Tambahkan descriptor baru ke list
        descriptorList.push(newDescriptor);

        // Simpan kembali sebagai JSON String
        const finalDescriptorString = JSON.stringify(descriptorList);
        
        const sql = `INSERT INTO karyawan (id_karyawan, nama, jabatan, foto, face_descriptor) VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama=VALUES(nama), jabatan=VALUES(jabatan), foto=VALUES(foto), face_descriptor=VALUES(face_descriptor)`;

        pool.query(sql, [id_karyawan, nama, jabatan, buffer, finalDescriptorString], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            
            console.log(`✅ Data tersimpan: ${id_karyawan} - ${nama} (Total Sampel: ${descriptorList.length})`);
            res.json({ success: true, message: `Berhasil disimpan. Total sampel wajah: ${descriptorList.length}` });
        });
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

    // [FIX] Query langsung (TANPA VIEW) agar SEMUA karyawan selalu tampil
    // View lama menggunakan CROSS JOIN yang menyebabkan hanya karyawan dengan data absensi yang muncul
    const sql = `
        SELECT 
            k.no_urut,
            k.id_karyawan,
            k.nama,
            k.jabatan,
            ? AS periode,
            (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
            COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) AS total_masuk,
            COALESCE(SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0) AS total_dl,
            COALESCE(SUM(CASE WHEN a.status = 'SAKIT' THEN 1 ELSE 0 END), 0) AS total_sakit,
            COALESCE(SUM(CASE WHEN a.status = 'IZIN' THEN 1 ELSE 0 END), 0) AS total_izin,
            COALESCE(SUM(CASE WHEN a.status = 'CUTI' THEN 1 ELSE 0 END), 0) AS total_cuti,
            GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0)) AS alpa,
            COALESCE(SUM(CASE WHEN a.telat_menit > 0 THEN 1 ELSE 0 END), 0) AS telat_kali,
            COALESCE(SUM(a.telat_menit), 0) AS telat_menit,
            COALESCE(SUM(CASE WHEN a.psw_menit > 0 THEN 1 ELSE 0 END), 0) AS psw_kali,
            COALESCE(SUM(a.psw_menit), 0) AS psw_menit,
            (COALESCE(SUM(a.telat_menit), 0) + COALESCE(SUM(a.psw_menit), 0)) AS total_pelanggaran_menit,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS tanpa_absen_pulang,
            COALESCE(SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan NOT LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS pulang_kali,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN ${POTONGAN_LUPA_PULANG} ELSE 0 END), 0) AS potongan_jam,
            SEC_TO_TIME(COALESCE(SUM(
                CASE 
                    WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar)
                    WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN
                        GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, 
                            CASE 
                                WHEN DAYOFWEEK(a.tanggal) = 6 THEN '${AUTO_PULANG_JUMAT}'
                                WHEN DAYOFWEEK(a.tanggal) = 7 THEN '${AUTO_PULANG_SABTU}'
                                ELSE '${AUTO_PULANG_DEFAULT}'
                            END
                        ))
                    ELSE 0 
                END
            ), 0)) AS total_jam_kerja
        FROM karyawan k
        LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?
        GROUP BY k.id_karyawan, k.no_urut, k.nama, k.jabatan
        ORDER BY k.no_urut ASC, k.nama ASC
    `;

    pool.query(sql, [periode, periode, periode, periode], (err, results) => {
        if (err) {
            console.error('❌ [REKAP] Error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }

        console.log(`\n📊 [REKAP] Periode: ${periode} | Total Pegawai: ${results.length}`);

        // [DEBUG] Verifikasi Perhitungan Total Pelanggaran (Telat + PSW)
        results.forEach(r => {
            const telat = parseInt(r.telat_menit) || 0;
            const psw = parseInt(r.psw_menit) || 0;
            if (telat > 0 || psw > 0) {
                console.log(`   ⚠️ ${r.nama}: Telat ${telat}m, PSW ${psw}m`);
            }
        });

        res.json({ success: true, data: results });
    });
});

// [NEW] Endpoint: Cetak Slip Gaji Resmi (HTML Print-Ready)
app.get('/api/slip_gaji/print', (req, res) => {
    const { id_karyawan, periode } = req.query;
    
    if (!id_karyawan || !periode) {
        return res.status(400).send("<h3>Error: Parameter id_karyawan dan periode (YYYY-MM) wajib disertakan.</h3>");
    }

    // [FIX] Query langsung tanpa VIEW agar data lengkap
    const sql = `
        SELECT 
            k.no_urut, k.id_karyawan, k.nama, k.jabatan,
            ? AS periode,
            (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
            COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) AS total_masuk,
            COALESCE(SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0) AS total_dl,
            COALESCE(SUM(CASE WHEN a.status = 'SAKIT' THEN 1 ELSE 0 END), 0) AS total_sakit,
            COALESCE(SUM(CASE WHEN a.status = 'IZIN' THEN 1 ELSE 0 END), 0) AS total_izin,
            COALESCE(SUM(CASE WHEN a.status = 'CUTI' THEN 1 ELSE 0 END), 0) AS total_cuti,
            GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0)) AS alpa,
            COALESCE(SUM(CASE WHEN a.telat_menit > 0 THEN 1 ELSE 0 END), 0) AS telat_kali,
            COALESCE(SUM(a.telat_menit), 0) AS telat_menit,
            COALESCE(SUM(CASE WHEN a.psw_menit > 0 THEN 1 ELSE 0 END), 0) AS psw_kali,
            COALESCE(SUM(a.psw_menit), 0) AS psw_menit,
            (COALESCE(SUM(a.telat_menit), 0) + COALESCE(SUM(a.psw_menit), 0)) AS total_pelanggaran_menit,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS tanpa_absen_pulang,
            COALESCE(SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan NOT LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS pulang_kali,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN ${POTONGAN_LUPA_PULANG} ELSE 0 END), 0) AS potongan_jam,
            SEC_TO_TIME(COALESCE(SUM(CASE WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar) WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, CASE WHEN DAYOFWEEK(a.tanggal) = 6 THEN '${AUTO_PULANG_JUMAT}' WHEN DAYOFWEEK(a.tanggal) = 7 THEN '${AUTO_PULANG_SABTU}' ELSE '${AUTO_PULANG_DEFAULT}' END)) ELSE 0 END), 0)) AS total_jam_kerja
        FROM karyawan k
        LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?
        WHERE k.id_karyawan = ?
        GROUP BY k.id_karyawan, k.no_urut, k.nama, k.jabatan
    `;
    
    pool.query(sql, [periode, periode, periode, periode, id_karyawan], (err, results) => {
        if (err) return res.status(500).send(err.message);
        if (results.length === 0) return res.status(404).send("<h3>Data absensi tidak ditemukan untuk periode ini.</h3>");

        const d = results[0];

        // --- SIMULASI PERHITUNGAN GAJI (Bisa disesuaikan / Ambil dari DB jika ada) ---
        const GAJI_POKOK = 5000000;      // Contoh Gaji Pokok
        const TUNJANGAN_HADIR = 50000;   // Per hari hadir
        const DENDA_TELAT_PER_MENIT = 1000; 
        const DENDA_PSW_PER_MENIT = 1000;
        const DENDA_ALPA = 150000;       // Per hari Alpha
        const DENDA_TANPA_ABSEN = 50000; // Denda per kejadian Tanpa Absen Pulang

        // Hitung Komponen
        const totalTunjanganHadir = d.total_masuk * TUNJANGAN_HADIR;
        const totalDendaTelat = d.telat_menit * DENDA_TELAT_PER_MENIT;
        const totalDendaPsw = d.psw_menit * DENDA_PSW_PER_MENIT;
        const totalDendaAlpa = d.alpa * DENDA_ALPA;
        const totalDendaTanpaAbsen = d.tanpa_absen_pulang * DENDA_TANPA_ABSEN;
        
        const totalPendapatan = GAJI_POKOK + totalTunjanganHadir;
        const totalPotongan = totalDendaTelat + totalDendaPsw + totalDendaAlpa + totalDendaTanpaAbsen;
        const gajiBersih = totalPendapatan - totalPotongan;

        // Formatter Rupiah
        const rp = (n) => "Rp " + n.toLocaleString('id-ID');

        // Template HTML Slip Gaji Resmi
        const html = `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Slip Gaji - ${d.nama}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #555; padding: 20px; display: flex; justify-content: center; }
                    .slip-container { width: 210mm; min-height: 140mm; background: white; padding: 40px; box-shadow: 0 0 15px rgba(0,0,0,0.3); position: relative; }
                    .header { border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
                    .company-info h1 { margin: 0; font-size: 22px; text-transform: uppercase; color: #2c3e50; }
                    .company-info p { margin: 2px 0; font-size: 12px; color: #7f8c8d; }
                    .slip-title { text-align: right; }
                    .slip-title h2 { margin: 0; font-size: 24px; color: #333; letter-spacing: 2px; }
                    .slip-title p { margin: 0; font-size: 14px; color: #666; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 13px; }
                    .info-row { display: flex; margin-bottom: 5px; }
                    .label { width: 100px; font-weight: bold; color: #555; }
                    .value { flex: 1; }
                    .section-header { background: #f2f2f2; padding: 8px; font-weight: bold; font-size: 13px; border-left: 4px solid #2c3e50; margin-bottom: 10px; margin-top: 20px; }
                    .table-rincian { width: 100%; border-collapse: collapse; font-size: 13px; }
                    .table-rincian td { padding: 6px 8px; border-bottom: 1px dashed #eee; }
                    .text-right { text-align: right; }
                    .text-red { color: #e74c3c; }
                    .total-row td { border-top: 2px solid #333; border-bottom: none; padding-top: 10px; font-weight: bold; font-size: 15px; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
                    .ttd-box { text-align: center; width: 150px; }
                    .ttd-space { height: 60px; }
                    .ttd-line { border-top: 1px solid #333; margin-top: 5px; }
                    @media print {
                        body { background: white; padding: 0; }
                        .slip-container { box-shadow: none; width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="slip-container">
                    <div class="header">
                        <div class="company-info">
                            <h1>PT. BIOMETRIK INDONESIA</h1>
                            <p>Jl. Teknologi Masa Depan No. 88, Jakarta Selatan</p>
                            <p>Telp: (021) 555-8888 | Email: hrd@biometrik.co.id</p>
                        </div>
                        <div class="slip-title">
                            <h2>SLIP GAJI</h2>
                            <p>Periode: ${d.periode}</p>
                        </div>
                    </div>

                    <div class="info-grid">
                        <div>
                            <div class="info-row"><span class="label">ID Karyawan</span><span class="value">: ${d.id_karyawan}</span></div>
                            <div class="info-row"><span class="label">Nama</span><span class="value">: <strong>${d.nama}</strong></span></div>
                            <div class="info-row"><span class="label">Jabatan</span><span class="value">: ${d.jabatan}</span></div>
                        </div>
                        <div>
                            <div class="info-row"><span class="label">Status</span><span class="value">: Karyawan Tetap</span></div>
                            <div class="info-row"><span class="label">Cetak</span><span class="value">: ${new Date().toLocaleDateString('id-ID')}</span></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 30px;">
                        <div style="flex: 1;">
                            <div class="section-header">PENERIMAAN (INCOME)</div>
                            <table class="table-rincian">
                                <tr><td>Gaji Pokok</td><td class="text-right">${rp(GAJI_POKOK)}</td></tr>
                                <tr><td>Tunjangan Hadir (${d.total_masuk} hari)</td><td class="text-right">${rp(totalTunjanganHadir)}</td></tr>
                                <tr><td><strong>Total Penerimaan</strong></td><td class="text-right"><strong>${rp(totalPendapatan)}</strong></td></tr>
                            </table>
                        </div>
                        <div style="flex: 1;">
                            <div class="section-header">POTONGAN (DEDUCTION)</div>
                            <table class="table-rincian">
                                <tr><td>Telat (${d.telat_menit} menit)</td><td class="text-right text-red">(${rp(totalDendaTelat)})</td></tr>
                                <tr><td>PSW (${d.psw_menit} menit)</td><td class="text-right text-red">(${rp(totalDendaPsw)})</td></tr>
                                <tr><td>Alpha (${d.alpa} hari)</td><td class="text-right text-red">(${rp(totalDendaAlpa)})</td></tr>
                                <tr><td>Tanpa Absen Pulang (${d.tanpa_absen_pulang}x)</td><td class="text-right text-red">(${rp(totalDendaTanpaAbsen)})</td></tr>
                                <tr><td><strong>Total Potongan</strong></td><td class="text-right text-red"><strong>(${rp(totalPotongan)})</strong></td></tr>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top: 20px; border: 2px solid #333; padding: 15px; background: #f9f9f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-size: 14px; font-weight: bold;">TAKE HOME PAY (GAJI BERSIH)</div>
                            <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${rp(gajiBersih)}</div>
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 5px; font-style: italic;">* Terbilang: ${rp(gajiBersih).replace('Rp', '')} Rupiah</div>
                    </div>

                    <div class="footer">
                        <div class="ttd-box">
                            <div>Penerima,</div>
                            <div class="ttd-space"></div>
                            <div class="ttd-line"></div>
                            <div>${d.nama}</div>
                        </div>
                        <div class="ttd-box">
                            <div>Jakarta, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                            <div>Manager HRD,</div>
                            <div class="ttd-space"></div>
                            <div class="ttd-line"></div>
                            <div>Admin Biometrik</div>
                        </div>
                    </div>
                </div>
                <script>
                    // Auto Print saat dibuka
                    setTimeout(() => window.print(), 1000);
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
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

    // [FIX] Query langsung tanpa VIEW agar SEMUA karyawan tampil
    const sql = `
        SELECT 
            k.no_urut, k.id_karyawan, k.nama, k.jabatan,
            ? AS periode,
            (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) AS total_hari_kerja,
            COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) AS total_masuk,
            COALESCE(SUM(CASE WHEN a.status IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0) AS total_dl,
            COALESCE(SUM(CASE WHEN a.status = 'SAKIT' THEN 1 ELSE 0 END), 0) AS total_sakit,
            COALESCE(SUM(CASE WHEN a.status = 'IZIN' THEN 1 ELSE 0 END), 0) AS total_izin,
            COALESCE(SUM(CASE WHEN a.status = 'CUTI' THEN 1 ELSE 0 END), 0) AS total_cuti,
            GREATEST(0, (SELECT COUNT(DISTINCT tanggal) FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND (k.tanggal_registrasi IS NULL OR tanggal >= DATE(k.tanggal_registrasi))) - COALESCE(SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_masuk != '-' AND a.status NOT IN ('IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR') THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN a.status IN ('IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'DL', 'DINAS_LUAR') THEN 1 ELSE 0 END), 0)) AS alpa,
            COALESCE(SUM(CASE WHEN a.telat_menit > 0 THEN 1 ELSE 0 END), 0) AS telat_kali,
            COALESCE(SUM(a.telat_menit), 0) AS telat_menit,
            COALESCE(SUM(CASE WHEN a.psw_menit > 0 THEN 1 ELSE 0 END), 0) AS psw_kali,
            COALESCE(SUM(a.psw_menit), 0) AS psw_menit,
            (COALESCE(SUM(a.telat_menit), 0) + COALESCE(SUM(a.psw_menit), 0)) AS total_pelanggaran_menit,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS tanpa_absen_pulang,
            COALESCE(SUM(CASE WHEN a.jam_keluar IS NOT NULL AND (a.keterangan IS NULL OR a.keterangan NOT LIKE '%Otomatis%') THEN 1 ELSE 0 END), 0) AS pulang_kali,
            COALESCE(SUM(CASE WHEN (a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR (a.keterangan LIKE '%Otomatis%') THEN ${POTONGAN_LUPA_PULANG} ELSE 0 END), 0) AS potongan_jam,
            SEC_TO_TIME(COALESCE(SUM(CASE WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar) WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, CASE WHEN DAYOFWEEK(a.tanggal) = 6 THEN '${AUTO_PULANG_JUMAT}' WHEN DAYOFWEEK(a.tanggal) = 7 THEN '${AUTO_PULANG_SABTU}' ELSE '${AUTO_PULANG_DEFAULT}' END)) ELSE 0 END), 0)) AS total_jam_kerja
        FROM karyawan k
        LEFT JOIN absensi a ON k.id_karyawan = a.id_karyawan AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?
        GROUP BY k.id_karyawan, k.no_urut, k.nama, k.jabatan
        ORDER BY k.no_urut ASC, k.nama ASC
    `;

    pool.query(sql, [periode, periode, periode, periode], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// Endpoint: Data Absensi Harian (Sesuai View Baru di skema_final.sql)
app.get('/api/absensi/harian', (req, res) => {
    // Tambahkan parameter ?tanggal=YYYY-MM-DD atau ?bulan=YYYY-MM jika ingin melihat history
    const tanggal = req.query.tanggal;
    const bulan = req.query.bulan;
    let sql = "SELECT * FROM view_absensi_harian";
    let params = [];

    if (tanggal) {
        sql += " WHERE tanggal = ?";
        params.push(tanggal);
        sql += " ORDER BY (jam_masuk IS NULL) DESC, jam_masuk DESC";
    } else if (bulan) {
        sql += " WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?";
        params.push(bulan);
        sql += " ORDER BY id_karyawan ASC, tanggal ASC";
    } else {
        sql += " WHERE tanggal = CURDATE()";
        sql += " ORDER BY (jam_masuk IS NULL) DESC, jam_masuk DESC";
    }
    
    pool.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// Endpoint: Data Absensi Hari Ini (Khusus Scan Page Diagnostic)
app.get('/api/absensi/today', (req, res) => {
    const sql = "SELECT id_karyawan, nama_karyawan AS nama, jabatan, jam_masuk, jam_keluar, status FROM view_absensi_harian WHERE tanggal = CURDATE() ORDER BY jam_masuk DESC";
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json(results);
    });
});

// Endpoint: Data History Absensi Pegawai per Bulan (Detail Pelanggaran)
app.get('/api/absensi/history/:id_karyawan', (req, res) => {
    const { id_karyawan } = req.params;
    const { periode, tipe } = req.query; // tipe='tanpa_pulang' | 'alpa'
    
    if (tipe === 'alpa') {
        const sql = `
            SELECT DISTINCT a.tanggal, '-' AS jam_masuk, '-' AS jam_keluar, 'Tidak Hadir Tanpa Keterangan (Alpa)' AS keterangan, 'ALPA' AS status 
            FROM absensi a
            JOIN karyawan k ON k.id_karyawan = ?
            WHERE DATE_FORMAT(a.tanggal, '%Y-%m') = ? 
              AND a.tanggal <= CURDATE()
              AND (k.tanggal_registrasi IS NULL OR a.tanggal >= DATE(k.tanggal_registrasi))
              AND a.tanggal NOT IN (
                  SELECT tanggal FROM absensi WHERE id_karyawan = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?
              )
            ORDER BY a.tanggal ASC
        `;
        pool.query(sql, [id_karyawan, periode, id_karyawan, periode], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: results });
        });
        return;
    }

    let sql = "SELECT tanggal, jam_masuk, jam_keluar, keterangan, status, psw_menit, telat_menit FROM view_absensi_harian WHERE id_karyawan = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?";
    let params = [id_karyawan, periode];
    
    if (tipe === 'tanpa_pulang') {
        sql += " AND ((jam_keluar IS NULL AND tanggal < CURDATE()) OR keterangan LIKE '%Otomatis%')";
    } else if (tipe === 'psw') {
        sql += " AND psw_menit > 0";
    }
    
    sql += " ORDER BY tanggal ASC";
    
    pool.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// [NEW] Endpoint: Request Ubah Password (dari portal-online)
app.post('/api/pegawai/req-ubah-password', (req, res) => {
    const { id_karyawan, password_baru } = req.body;
    if (!id_karyawan || !password_baru) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    
    // 1. Cek apakah id_karyawan benar-benar ada di tabel karyawan
    pool.query('SELECT nama FROM karyawan WHERE id_karyawan = ?', [id_karyawan], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            // ID tidak ditemukan
            return res.status(404).json({ success: false, message: 'ID Karyawan tidak ditemukan di database.' });
        }

        // 2. Jika ada, lanjutkan insert ke req_ubah_password
        const hashedPass = hashPassword(password_baru);
        
        const sql = `INSERT INTO req_ubah_password (id_karyawan, password_baru, status) VALUES (?, ?, 'pending')`;
        pool.query(sql, [id_karyawan, hashedPass], (err2) => {
            if (err2) return res.status(500).json({ success: false, message: err2.message });
            res.json({ success: true, message: 'Permintaan ubah password berhasil dikirim. Menunggu persetujuan Admin.' });
        });
    });
});

// [NEW] Endpoint: Cek Status Request Ubah Password (untuk polling dari Portal Online)
app.get('/api/pegawai/req-ubah-password/status', (req, res) => {
    const { id_karyawan } = req.query;
    if (!id_karyawan) return res.status(400).json({ success: false, message: 'ID Karyawan diperlukan' });

    const sql = `
        SELECT status 
        FROM req_ubah_password 
        WHERE id_karyawan = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    `;
    pool.query(sql, [id_karyawan], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length === 0) return res.json({ success: true, status: 'none' });
        res.json({ success: true, status: results[0].status });
    });
});

// [NEW] Endpoint: Ambil Daftar Request Password Pending (untuk Admin)
app.get('/api/admin/req-ubah-password', (req, res) => {
    const sql = `
        SELECT r.id_req, r.id_karyawan, k.nama, r.status, r.created_at 
        FROM req_ubah_password r
        JOIN karyawan k ON r.id_karyawan = k.id_karyawan
        WHERE r.status = 'pending'
        ORDER BY r.created_at DESC
    `;
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// [NEW] Endpoint: Setujui/Tolak Request Ubah Password (dari Admin)
app.post('/api/admin/approve-password', (req, res) => {
    const { id_req, action } = req.body; // action: 'approve' atau 'reject'
    if (!id_req || !action) return res.status(400).json({ success: false, message: 'Parameter tidak valid' });
    
    if (action === 'reject') {
        pool.query(`UPDATE req_ubah_password SET status = 'rejected' WHERE id_req = ?`, [id_req], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            return res.json({ success: true, message: 'Permintaan ditolak.' });
        });
    } else if (action === 'approve') {
        // 1. Ambil password_baru dari tabel req
        pool.query(`SELECT id_karyawan, password_baru FROM req_ubah_password WHERE id_req = ? AND status = 'pending'`, [id_req], (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Permintaan tidak ditemukan atau sudah diproses.' });
            
            const { id_karyawan, password_baru } = rows[0];
            
            // 2. Update akun_pegawai
            pool.query(`UPDATE akun_pegawai SET password = ? WHERE id_karyawan = ?`, [password_baru, id_karyawan], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                
                // 3. Tandai request menjadi approved
                pool.query(`UPDATE req_ubah_password SET status = 'approved' WHERE id_req = ?`, [id_req], (err) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    res.json({ success: true, message: 'Password berhasil diubah!' });
                });
            });
        });
    }
});

// Endpoint: Data Absensi Bulanan Matrix (Menyamping)
app.get('/api/absensi/bulanan/matrix', (req, res) => {
    let periode = req.query.periode; // format YYYY-MM
    if (!periode) {
        const now = new Date();
        periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const sqlKaryawan = "SELECT id_karyawan, nama, jabatan FROM karyawan ORDER BY no_urut ASC, nama ASC";
    const sqlAbsensi = `
        SELECT a.id_karyawan, a.tanggal, a.jam_masuk, a.jam_keluar, a.status, a.keterangan, a.telat_menit, a.psw_menit 
        FROM absensi a 
        WHERE DATE_FORMAT(a.tanggal, '%Y-%m') = ?
    `;

    pool.query(sqlKaryawan, (err, karyawanList) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        console.log(`\n📋 [MATRIX] Periode: ${periode} | Total Karyawan di DB: ${karyawanList.length}`);
        karyawanList.forEach((k, i) => console.log(`   ${i+1}. ${k.id_karyawan} - ${k.nama}`));

        pool.query(sqlAbsensi, [periode], (err, absensiList) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            const [year, month] = periode.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();

            const absensiMap = {};
            absensiList.forEach(row => {
                const day = new Date(row.tanggal).getDate();
                if (!absensiMap[row.id_karyawan]) {
                    absensiMap[row.id_karyawan] = {};
                }
                absensiMap[row.id_karyawan][day] = {
                    jam_masuk: row.jam_masuk,
                    jam_keluar: row.jam_keluar,
                    status: row.status,
                    keterangan: row.keterangan,
                    telat_menit: row.telat_menit,
                    psw_menit: row.psw_menit
                };
            });

            const matrix = karyawanList.map(k => {
                const hari = {};
                for (let d = 1; d <= daysInMonth; d++) {
                    hari[d] = absensiMap[k.id_karyawan]?.[d] || null;
                }
                return {
                    id_karyawan: k.id_karyawan,
                    nama: k.nama,
                    jabatan: k.jabatan,
                    hari: hari
                };
            });

            res.json({
                success: true,
                periode: periode,
                daysInMonth: daysInMonth,
                data: matrix
            });
        });
    });
});

// Endpoint: Ambil Descriptors untuk Absensi (Scan Wajah)
app.get('/api/karyawan/descriptors', (req, res) => {
    // UPDATE: Ambil data lengkap (id, jabatan, foto) agar scan.js bisa menampilkan profil
    const sql = "SELECT id_karyawan, nama, jabatan, foto, face_descriptor, no_urut FROM karyawan ORDER BY no_urut ASC, nama ASC";

    pool.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        const faces = results
            .map(row => {
                try {
                    // Konversi Buffer foto ke Base64 agar bisa ditampilkan di frontend
                    const fotoBase64 = row.foto ? row.foto.toString('base64') : '';

                    // Handle descriptor parsing safely
                    let parsedDescriptor = null;
                    if (row.face_descriptor) {
                        parsedDescriptor = JSON.parse(row.face_descriptor);
                    }

                    return {
                        id_karyawan: row.id_karyawan,
                        nama: row.nama,
                        jabatan: row.jabatan,
                        foto: fotoBase64,
                        face_descriptor: parsedDescriptor,
                        no_urut: row.no_urut || 9999
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

// [FIX] Endpoint: Get Detail Karyawan (Single) - Diperlukan untuk Modal Dashboard
app.get('/api/karyawan/:id', (req, res) => {
    const id = req.params.id;
    pool.query('SELECT id_karyawan, nama, jabatan, foto FROM karyawan WHERE id_karyawan = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        
        const data = results[0];
        if (data.foto) data.foto = data.foto.toString('base64');
        res.json({ success: true, data: data });
    });
});

// 3. API Hapus Akun Pegawai (Untuk reset akun portal)
app.delete('/api/pegawai/akun/:id_karyawan', (req, res) => {
    const id = req.params.id_karyawan;
    pool.query('DELETE FROM akun_pegawai WHERE id_karyawan = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
        if (results.affectedRows === 0) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
        res.json({ success: true, message: 'Akun portal berhasil dihapus.' });
    });
});

// 4. API Riwayat Rekap Bulanan Karyawan
app.get('/api/riwayat/rekap/:id_karyawan', (req, res) => {
    const id = req.params.id_karyawan;
    pool.query('SELECT * FROM view_rekap_bulanan WHERE id_karyawan = ? ORDER BY periode DESC', [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });
        res.json({ success: true, data: results });
    });
});

// Endpoint untuk Dashboard Karyawan (Edit Nama/Jabatan)
app.put('/api/karyawan/:id', (req, res) => {
    const id = req.params.id;
    const { nama, jabatan, no_urut } = req.body;

    if (!nama || !jabatan) {
        return res.status(400).json({ success: false, message: 'Nama dan Jabatan harus diisi.' });
    }

    const sql = 'UPDATE karyawan SET nama = ?, jabatan = ?, no_urut = ? WHERE id_karyawan = ?';
    pool.query(sql, [nama, jabatan, no_urut || 9999, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        res.json({ success: true, message: 'Data karyawan berhasil diperbarui.' });
    });
});

// [NEW] Endpoint: Update Foto Karyawan Manual (Tanpa Ubah Biometrik)
app.put('/api/karyawan/:id/photo', (req, res) => {
    const id = req.params.id;
    const { foto } = req.body; // Base64 string

    if (!foto) return res.status(400).json({ success: false, message: 'Data foto tidak dikirim.' });

    const base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const sql = 'UPDATE karyawan SET foto = ? WHERE id_karyawan = ?';
    pool.query(sql, [buffer, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        res.json({ success: true, message: 'Foto profil berhasil diperbarui.' });
    });
});

// [NEW] Endpoint: Reset Biometric Data (Hapus Foto & Descriptor Wajah)
app.put('/api/karyawan/:id/reset_biometric', (req, res) => {
    const id = req.params.id;
    const sql = 'UPDATE karyawan SET face_descriptor = NULL, foto = NULL WHERE id_karyawan = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ID tidak ditemukan' });
        res.json({ success: true, message: 'Data biometrik (Wajah & Foto) berhasil direset.' });
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
                        statusColor: 'red',
                        jam_masuk_start: JAM_MASUK_START
                    });
                }

                // HITUNG TELAT (Menit) SAAT MASUK
                let telatMenit = 0;
                if (currentTime > BATAS_TELAT) {
                    const [hC, mC, sC] = currentTime.split(':').map(Number);
                    // [REQUEST] Menghitung telat dimulai dari BATAS_TELAT (diambil dari .env)
                    const [hS, mS, sS] = BATAS_TELAT.split(':').map(Number); 
                    const curSec = hC * 3600 + mC * 60 + sC;
                    const startSec = hS * 3600 + mS * 60 + sS;
                    telatMenit = Math.floor((curSec - startSec) / 60);
                    console.log(`   ⚠️ Terlambat: ${telatMenit} menit (Masuk: ${currentTime}, Batas: ${BATAS_TELAT})`);
                }

                const insertSql = 'INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, status, telat_menit) VALUES (?, ?, ?, ?, ?)';
                pool.query(insertSql, [id_karyawan, today, currentTime, 'HADIR', telatMenit], (err) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    
                    // [UPDATE] Tentukan warna status (Kuning jika telat)
                    const responseColor = telatMenit > 0 ? 'yellow' : 'green';

                    res.json({
                        success: true,
                        message: `Selamat Pagi, Absensi Masuk Berhasil.`,
                        nama: k.nama,
                        jabatan: k.jabatan,
                        result_code: 'CHECK_IN_SUCCESS',
                        statusColor: responseColor,
                        telat_menit: telatMenit // Kirim data telat ke frontend
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
                    
                    // [UPDATE] Deteksi Hari untuk Jam Pulang & Batas Min Pulang Dinamis
                    const dayIndex = now.getDay(); // 0=Minggu, 1=Senin... 5=Jumat, 6=Sabtu
                    let jamPulangEfektif = JAM_PULANG_START;
                    // Gunakan BATAS_MIN_PULANG dari .env (11:00:00) untuk semua hari
                    let batasMinPulangEfektif = BATAS_MIN_PULANG; 

                    if (dayIndex === 5) jamPulangEfektif = JAM_PULANG_JUMAT;
                    else if (dayIndex === 6) jamPulangEfektif = JAM_PULANG_SABTU;

                    console.log(`[CHECK-OUT] Hari: ${dayIndex}, Jam Pulang: ${jamPulangEfektif}, Min Pulang: ${batasMinPulangEfektif}`);

                    // --- LOGIKA BARU: Cek Pulang Sebelum Waktunya (PSW) ---
                    let keteranganPulang = null;
                    let pswMenit = 0;
                    let pesanRespon = 'Hati-hati di jalan, Absensi Pulang Berhasil.';
                    
                    if (currentTime < jamPulangEfektif) {
                        // Fungsi untuk konversi HH:MM:SS ke total detik
                        const timeToSeconds = (timeStr) => {
                            const [h, m, s] = timeStr.split(':').map(Number);
                            return h * 3600 + m * 60 + s;
                        };

                        const detikPulangStandar = timeToSeconds(jamPulangEfektif);
                        const detikPulangAktual = timeToSeconds(currentTime);
                        const selisihMenitPsw = Math.floor((detikPulangStandar - detikPulangAktual) / 60);

                        // Hanya catat jika selisihnya positif (benar-benar pulang lebih awal)
                        if (selisihMenitPsw > 0) {
                            pswMenit = selisihMenitPsw;
                            keteranganPulang = `PSW: ${selisihMenitPsw} menit`;
                            pesanRespon = `Pulang Sebelum Waktunya (${selisihMenitPsw} menit). Hati-hati di jalan.`;
                        }
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
                            statusColor: 'yellow',
                            jam_masuk: dataAbsen.jam_masuk
                        });
                    }

                    // [FIX] Penolakan Scan Kedua: Jika sudah absen masuk, scan selanjutnya ditolak sampai batas waktu minimal pulang
                    if (currentTime < batasMinPulangEfektif) {
                        return res.json({
                            success: false,
                            message: `Anda sudah absen masuk pada pukul ${dataAbsen.jam_masuk}. Scan pulang baru diizinkan mulai pukul ${batasMinPulangEfektif}.`,
                            nama: k.nama,
                            jabatan: k.jabatan,
                            result_code: 'ALREADY_CHECKED_IN',
                            statusColor: 'yellow',
                            jam_masuk: dataAbsen.jam_masuk,
                            batas_min_pulang: batasMinPulangEfektif
                        });
                    }

                    // Tentukan warna status: Hijau (Normal) atau Kuning (PSW)
                    const finalStatusColor = pswMenit > 0 ? 'yellow' : 'green';

                    // [FIX] Gunakan CONCAT agar keterangan lama (jika ada) tidak hilang saat update PSW
                    // Contoh hasil: "Datang Telat [PSW: 15 menit]"
                    const sqlUpdate = 'UPDATE absensi SET jam_keluar = ?, keterangan = CONCAT(IFNULL(keterangan, ""), ?), psw_menit = ? WHERE id_absensi = ?';
                    const ketTambahan = keteranganPulang ? ` [${keteranganPulang}]` : '';

                    pool.query(sqlUpdate, [currentTime, ketTambahan, pswMenit, dataAbsen.id_absensi], (err) => {
                        if (err) return res.status(500).json({ success: false, message: err.message });

                        res.json({
                            success: true,
                            message: pesanRespon,
                            nama: k.nama,
                            jabatan: k.jabatan,
                            result_code: 'CHECK_OUT_SUCCESS',
                            statusColor: finalStatusColor,
                            psw_menit: pswMenit // Kirim data PSW ke frontend untuk TTS
                        });
                    });
                }
            }
        });
    });
});

// Endpoint: Input Manual Absensi (Dinas Luar / Izin / Sakit)
app.post('/api/absensi/manual', (req, res) => {
    const { id_karyawan, status, keterangan, tanggal, jam_masuk, jam_keluar } = req.body;

    if (!id_karyawan || !status || !tanggal) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap (ID, Status, Tanggal wajib diisi)' });
    }

    // Tentukan jam masuk/keluar otomatis jika DL agar terhitung jam kerja & tidak alpa
    let finalJamMasuk = null;
    let finalJamKeluar = null;
    let finalStatus = status;
    let telatMenit = 0;
    let pswMenit = 0;

    // Helper konversi waktu ke detik
    const timeToSeconds = (t) => {
        if (!t) return 0;
        const parts = t.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    };

    if (status === 'DL') {
        // [UPDATE] Gunakan jam inputan user jika ada agar jam kerja akurat. Jika kosong, baru pakai default.
        finalJamMasuk = jam_masuk ? (jam_masuk.length === 5 ? jam_masuk + ':00' : jam_masuk) : JAM_KERJA_MULAI;
        finalJamKeluar = jam_keluar ? (jam_keluar.length === 5 ? jam_keluar + ':00' : jam_keluar) : JAM_PULANG_START;
    } else if (status === 'HADIR_MANUAL') {
        // Pastikan format waktu lengkap HH:MM:SS
        finalJamMasuk = jam_masuk ? (jam_masuk.length === 5 ? jam_masuk + ':00' : jam_masuk) : null;
        finalJamKeluar = jam_keluar ? (jam_keluar.length === 5 ? jam_keluar + ':00' : jam_keluar) : null;
        // [FIX] Simpan sebagai HADIR agar otomatis masuk ke rekap bulanan seperti absen normal
        finalStatus = 'HADIR'; 

        // [FIX] Hitung Keterlambatan Manual
        if (finalJamMasuk && finalJamMasuk > BATAS_TELAT) {
            const masukSec = timeToSeconds(finalJamMasuk);
            const startSec = timeToSeconds(BATAS_TELAT);
            telatMenit = Math.floor((masukSec - startSec) / 60);
        }

        // [FIX] Hitung PSW Manual
        if (finalJamKeluar && finalJamKeluar < JAM_PULANG_START) {
            const pulangSec = timeToSeconds(finalJamKeluar);
            const batasPulangSec = timeToSeconds(JAM_PULANG_START);
            pswMenit = Math.floor((batasPulangSec - pulangSec) / 60);
        }
    }

    // UPDATE: Tambahkan kolom telat_menit dan psw_menit ke query INSERT
    const sql = `INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status), keterangan = VALUES(keterangan),
                 telat_menit = VALUES(telat_menit), psw_menit = VALUES(psw_menit)`;

    pool.query(sql, [id_karyawan, tanggal, finalJamMasuk, finalJamKeluar, finalStatus, keterangan, telatMenit, pswMenit], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Data manual berhasil disimpan (Telat/PSW terhitung).' });
    });
});

// Endpoint: Hapus Absensi Harian
app.delete('/api/absensi/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM absensi WHERE id_absensi = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan' });
        res.json({ success: true, message: 'Data absensi berhasil dihapus.' });
    });
});

// Endpoint: Update Absensi (Edit Manual dari Dashboard)
app.put('/api/absensi/:id', (req, res) => {
    const id = req.params.id;
    const { tanggal, jam_masuk, jam_keluar, status, keterangan } = req.body;

    // [FIX] Validasi Tanggal
    if (!tanggal) {
        return res.status(400).json({ success: false, message: 'Tanggal harus diisi.' });
    }

    // Helper: Hitung Telat & PSW ulang jika jam berubah
    let telatMenit = 0;
    let pswMenit = 0;
    
    const timeToSeconds = (t) => {
        if (!t) return 0;
        const parts = t.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    };

    if (jam_masuk && jam_masuk > BATAS_TELAT) {
        const masukSec = timeToSeconds(jam_masuk);
        const startSec = timeToSeconds(BATAS_TELAT);
        telatMenit = Math.floor((masukSec - startSec) / 60);
    }

    // Cek hari untuk jam pulang (Jumat/Sabtu/Default)
    const dateObj = new Date(tanggal);
    const dayIndex = dateObj.getDay();
    let jamPulangEfektif = JAM_PULANG_START;
    if (dayIndex === 5) jamPulangEfektif = JAM_PULANG_JUMAT;
    else if (dayIndex === 6) jamPulangEfektif = JAM_PULANG_SABTU;

    if (jam_keluar && jam_keluar < jamPulangEfektif) {
        const pulangSec = timeToSeconds(jam_keluar);
        const batasPulangSec = timeToSeconds(jamPulangEfektif); // [FIX] Gunakan jamPulangEfektif
        pswMenit = Math.floor((batasPulangSec - pulangSec) / 60);
    }

    const sql = `UPDATE absensi SET tanggal = ?, jam_masuk = ?, jam_keluar = ?, status = ?, keterangan = ?, telat_menit = ?, psw_menit = ? WHERE id_absensi = ?`;
    const finalMasuk = jam_masuk || null;
    const finalKeluar = jam_keluar || null;

    pool.query(sql, [tanggal, finalMasuk, finalKeluar, status, keterangan, telatMenit, pswMenit, id], (err, result) => {
        if (err) {
            // [FIX] Handle Duplicate Entry Error specifically
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: 'Data absensi untuk karyawan ini pada tanggal tersebut sudah ada.' });
            }
            return res.status(500).json({ success: false, message: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        
        // [NEW] Trigger instant push to Aiven
        pushToAiven(id);
        
        res.json({ success: true, message: 'Data absensi berhasil diperbarui.' });
    });
});

// Helper for instant push
async function pushToAiven(id_absensi) {
    try {
        const mysqlPromise = require('mysql2/promise');
        const localDb = await mysqlPromise.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
            dateStrings: true, timezone: '+07:00'
        });
        const cloudDb = await mysqlPromise.createConnection({
            host: process.env.CLOUD_DB_HOST,
            port: process.env.CLOUD_DB_PORT,
            user: process.env.CLOUD_DB_USER,
            password: process.env.CLOUD_DB_PASS,
            database: process.env.CLOUD_DB_NAME,
            ssl: { rejectUnauthorized: false },
            dateStrings: true, timezone: '+07:00'
        });
        const [absensiList] = await localDb.query("SELECT * FROM absensi WHERE id_absensi = ?", [id_absensi]);
        if (absensiList.length > 0) {
            const a = absensiList[0];
            await cloudDb.query(
                `INSERT INTO absensi (id_absensi, id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status), 
                 keterangan = VALUES(keterangan), telat_menit = VALUES(telat_menit), psw_menit = VALUES(psw_menit)`,
                [a.id_absensi, a.id_karyawan, a.tanggal, a.jam_masuk, a.jam_keluar, a.status, a.keterangan, a.telat_menit, a.psw_menit]
            );
        }
        await localDb.end();
        await cloudDb.end();
    } catch(e) { console.error("Aiven instant sync error:", e.message); }
}

// --- API ENDPOINTS KHUSUS MONITORING (monitor.html) ---

// 1. Get All Periodes (Untuk Filter Dropdown)
app.get('/api/rekap_all_periodes', (req, res) => {
    const sql = "SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') as periode_bulan FROM absensi ORDER BY periode_bulan DESC";
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// 2. Monitoring: Lupa Pulang
app.get('/api/monitoring/lupa_pulang', (req, res) => {
    const { tanggal, periode } = req.query;
    // Query dasar
    let sql = `SELECT k.id_karyawan, k.nama, 1 as total_kasus 
               FROM absensi a JOIN karyawan k ON a.id_karyawan = k.id_karyawan 
               WHERE ((a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR a.keterangan LIKE '%Tanpa Absen Pulang%' OR a.keterangan LIKE '%Lupa Absen Pulang%')`;
    
    const params = [];
    if (tanggal) {
        sql += " AND a.tanggal = ?";
        params.push(tanggal);
    } else if (periode) {
        // Jika bulanan, hitung total kasus per orang
        sql = `SELECT k.id_karyawan, k.nama, COUNT(*) as total_kasus 
               FROM absensi a JOIN karyawan k ON a.id_karyawan = k.id_karyawan 
               WHERE ((a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR a.keterangan LIKE '%Tanpa Absen Pulang%' OR a.keterangan LIKE '%Lupa Absen Pulang%')
               AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?
               GROUP BY k.id_karyawan, k.nama HAVING total_kasus > 0 ORDER BY total_kasus DESC`;
        params.push(periode);
    }
    
    pool.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// 3. Monitoring: Terlambat Lengkap (Masuk Telat tapi Pulang)
app.get('/api/monitoring/terlambat_lengkap', (req, res) => {
    const { tanggal, periode } = req.query;
    let whereClause = `WHERE a.jam_masuk > '${BATAS_TELAT}' AND a.jam_keluar IS NOT NULL`;
    let params = [];

    if (tanggal) { whereClause += " AND a.tanggal = ?"; params.push(tanggal); }
    if (periode) { whereClause += " AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?"; params.push(periode); }

    let sql = `SELECT k.id_karyawan, k.nama, ${periode ? 'COUNT(*) as total_kasus' : '1 as total_kasus'}
               FROM absensi a JOIN karyawan k ON a.id_karyawan = k.id_karyawan ${whereClause}
               ${periode ? 'GROUP BY k.id_karyawan, k.nama HAVING total_kasus > 0 ORDER BY total_kasus DESC' : ''}`;

    pool.query(sql, params, (err, results) => res.json({ success: true, data: results }));
});

// 4. Monitoring: Terlambat & Lupa Pulang (Kasus Berat)
app.get('/api/monitoring/terlambat_lupa', (req, res) => {
    const { tanggal, periode } = req.query;
    let whereClause = `WHERE a.jam_masuk > '${BATAS_TELAT}' AND ((a.jam_keluar IS NULL AND a.tanggal < CURDATE()) OR a.keterangan LIKE '%Tanpa Absen Pulang%' OR a.keterangan LIKE '%Lupa Absen Pulang%')`;
    let params = [];

    if (tanggal) { whereClause += " AND a.tanggal = ?"; params.push(tanggal); }
    if (periode) { whereClause += " AND DATE_FORMAT(a.tanggal, '%Y-%m') = ?"; params.push(periode); }

    let sql = `SELECT k.id_karyawan, k.nama, ${periode ? 'COUNT(*) as total_kasus' : '1 as total_kasus'}
               FROM absensi a JOIN karyawan k ON a.id_karyawan = k.id_karyawan ${whereClause}
               ${periode ? 'GROUP BY k.id_karyawan, k.nama HAVING total_kasus > 0 ORDER BY total_kasus DESC' : ''}`;

    pool.query(sql, params, (err, results) => res.json({ success: true, data: results }));
});

// [NEW] Endpoint: Statistik Harian per Rentang Tanggal (Untuk Grafik)
app.get('/api/stats/daily-range', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, message: 'Start and End date required' });

    // Query untuk menghitung hadir dan telat per tanggal
    const sql = `
        SELECT 
            tanggal, 
            COUNT(*) as total_hadir,
            SUM(CASE WHEN jam_masuk > ? AND status NOT IN ('DL', 'DINAS_LUAR') THEN 1 ELSE 0 END) as total_telat
        FROM absensi 
        WHERE tanggal BETWEEN ? AND ?
        GROUP BY tanggal
        ORDER BY tanggal ASC
    `;
    
    pool.query(sql, [BATAS_TELAT, start, end], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// Endpoint: Get System Config (Agar Dashboard sinkron dengan .env)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        config: {
            jam_masuk_start: JAM_MASUK_START,
            jam_masuk_end: JAM_MASUK_END,
            jam_kerja_mulai: JAM_KERJA_MULAI,
            batas_telat: BATAS_TELAT,
            jam_pulang_start: JAM_PULANG_START,
            batas_min_pulang: BATAS_MIN_PULANG,
            auto_pulang_default: AUTO_PULANG_DEFAULT,
            potongan_lupa_pulang: POTONGAN_LUPA_PULANG,
            elevenlabs_api_key: ELEVENLABS_API_KEY,
            elevenlabs_voice_id: ELEVENLABS_VOICE_ID,
            cf_worker_tts_url: CF_WORKER_TTS_URL
        }
    });
});

// [NEW] Endpoint: Update System Config (Dari Dashboard)
app.post('/api/config', (req, res) => {
    const { jam_pulang_jumat, jam_pulang_sabtu } = req.body;
    
    if (jam_pulang_jumat) JAM_PULANG_JUMAT = formatTime(jam_pulang_jumat);
    if (jam_pulang_sabtu) JAM_PULANG_SABTU = formatTime(jam_pulang_sabtu);
    
    console.log(`\n⚙️  CONFIG UPDATED via Dashboard:`);
    console.log(`   - Jam Pulang Jumat: ${JAM_PULANG_JUMAT}`);
    console.log(`   - Jam Pulang Sabtu: ${JAM_PULANG_SABTU}`);
    
    res.json({ success: true, message: 'Konfigurasi waktu pulang berhasil diperbarui di server.' });
});

// [NEW] Endpoint untuk menjembatani request ke Cloudflare AI Gateway
app.post('/api/ai/generate-greeting', async (req, res) => {
    const { name, status } = req.body;
    if (!CF_WORKER_TTS_URL) return res.status(500).json({ success: false, message: 'Worker URL missing' });

    try {
        const response = await fetch(CF_WORKER_TTS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "greeting", name, status })
        });
        const result = await response.json();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- SCHEDULER: AUTO FIX LUPA PULANG (Setiap 1 Jam) ---
// Menutup absensi kemarin yang masih open (Lupa Pulang) secara otomatis & aman dari duplikasi
const runAutoFix = () => {
    // Query ini memperbaiki SEMUA data masa lalu sekaligus (Tanpa LIMIT) karena Unique Key menjamin 1 ID per hari
    // UPDATE: Tambahkan check jam_masuk IS NOT NULL agar hanya menutup yang valid (mencegah duplikasi error)
    // Logika: Saat tanggal server berubah (00:00), CURDATE() maju 1 hari, sehingga data kemarin otomatis tereksekusi.
    const sql = `
        UPDATE absensi 
        SET 
            jam_keluar = CASE 
                WHEN DAYOFWEEK(tanggal) = 6 THEN ? 
                WHEN DAYOFWEEK(tanggal) = 7 THEN ? 
                ELSE ? 
            END, 
            keterangan = CONCAT(IFNULL(keterangan, ''), ' [Otomatis: Tanpa Absen Pulang]'),
            psw_menit = 0
        WHERE jam_masuk IS NOT NULL AND jam_keluar IS NULL AND tanggal < CURDATE()
    `;

    pool.query(sql, [AUTO_PULANG_JUMAT, AUTO_PULANG_SABTU, AUTO_PULANG_DEFAULT], (err, result) => {
        if (err) console.error('⚠️ Auto-Fix Error:', err.message);
        else if (result.affectedRows > 0) {
            const timestamp = new Date().toLocaleString('id-ID');
            console.log(`[${timestamp}] 🤖 Auto-Fix: ${result.affectedRows} data diperbarui.`);
            console.log(`   ✅ LOGIKA FIX: Jam Pulang diset ke Default: ${AUTO_PULANG_DEFAULT}, Jumat: ${AUTO_PULANG_JUMAT}, Sabtu: ${AUTO_PULANG_SABTU}.`);
            console.log(`   ✅ TOTAL JAM KERJA: Dihitung dari Jam Masuk s/d Auto Pulang.`);
            console.log(`   ✅ SANKSI: Diterapkan potongan ${POTONGAN_LUPA_PULANG} Jam (dari .env).`);
        }
    });
};

// Jalankan sekali saat start untuk memastikan fungsi aktif, lalu ulangi setiap 1 jam
runAutoFix();
console.log('✅ Auto-Fix Scheduler: BERFUNGSI 100% (Interval 1 Jam)');
setInterval(runAutoFix, 3600000); 

// --- SCHEDULER: AUTO BACKUP DATABASE (Setiap Malam jam 02:00) ---
const BACKUP_DIR = path.join(__dirname, 'backups');

// Pastikan folder backup ada
if (!fs.existsSync(BACKUP_DIR)){
    try { fs.mkdirSync(BACKUP_DIR); } catch(e) {}
}

const runBackup = () => {
    const dbName = process.env.DB_NAME || 'biometrik_absensi_wajah_db';
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASS || '';
    
    const date = new Date();
    // Format Timestamp: YYYY-MM-DD_HH-mm-ss
    const timestamp = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0') + '_' +
        String(date.getHours()).padStart(2, '0') + '-' +
        String(date.getMinutes()).padStart(2, '0') + '-' +
        String(date.getSeconds()).padStart(2, '0');
        
    const fileName = `backup_${dbName}_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);

    // Command mysqldump (Pastikan mysqldump ada di Environment Variables PATH)
    const authPart = dbPass ? `-u ${dbUser} -p"${dbPass}"` : `-u ${dbUser}`;
    const cmd = `mysqldump ${authPart} --routines --events --triggers ${dbName} > "${filePath}"`;

    console.log(`[BACKUP] Memulai backup database otomatis...`);
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[BACKUP] Gagal: ${error.message}`);
            console.error(`[BACKUP] TIPS: Pastikan 'C:\\xampp\\mysql\\bin' sudah ditambahkan ke System Environment Variables (Path).`);
            return;
        }
        
        console.log(`[BACKUP] Sukses: ${fileName}`);
        
        // Rotasi: Hapus backup lama (Simpan 7 file terakhir untuk menghemat ruang)
        fs.readdir(BACKUP_DIR, (err, files) => {
            if (err) return;
            const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
            if (sqlFiles.length > 7) {
                const filesToDelete = sqlFiles.slice(0, sqlFiles.length - 7);
                filesToDelete.forEach(f => fs.unlink(path.join(BACKUP_DIR, f), () => {}));
            }
        });
    });
};

// Cek waktu setiap menit, jalankan backup jam 02:00
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) runBackup();
}, 60000);

// --- GLOBAL ERROR HANDLER (Mencegah server mati total) ---
process.on('uncaughtException', (err) => {
    console.error('❌ FATAL: Uncaught Exception:', err.message);
    console.error(err.stack);
    // Server tetap berjalan meskipun ada error fatal di satu thread
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==========================================
// API KHUSUS PORTAL PWA PEGAWAI
// ==========================================

// 1. API Registrasi Akun Pegawai
app.post('/api/pegawai/register', (req, res) => {
    const { id_karyawan, nama, username, password } = req.body;
    
    // Cek apakah ID dan Nama cocok di database karyawan
    pool.query('SELECT * FROM karyawan WHERE id_karyawan = ?', [id_karyawan], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
        if (results.length === 0) return res.status(400).json({ success: false, message: 'ID Karyawan tidak ditemukan.' });
        
        // Kita bandingkan nama case-insensitive
        const dbName = results[0].nama.trim().toLowerCase();
        const inputName = nama.trim().toLowerCase();
        if (dbName !== inputName && !dbName.includes(inputName) && !inputName.includes(dbName)) {
            return res.status(400).json({ success: false, message: 'Nama tidak cocok dengan data kepegawaian.' });
        }
        
        const hashedPassword = hashPassword(password);
        
        // Buat Akun
        pool.query('INSERT INTO akun_pegawai (id_karyawan, username, password) VALUES (?, ?, ?)', 
        [id_karyawan, username, hashedPassword], (err2) => {
            if (err2) {
                if (err2.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Username sudah digunakan atau akun untuk ID ini sudah ada.' });
                return res.status(500).json({ success: false, message: err2.message });
            }
            res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
        });
    });
});

// 2. API Login Pegawai
app.post('/api/pegawai/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = hashPassword(String(password));
    
    const sql = `
        SELECT a.id_karyawan, a.username, k.nama, k.jabatan 
        FROM akun_pegawai a 
        JOIN karyawan k ON a.id_karyawan = k.id_karyawan 
        WHERE (a.username = ? OR a.id_karyawan = ?) AND a.password = ?
    `;
    
    pool.query(sql, [username, username, hashedPassword], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
        if (results.length === 0) return res.status(401).json({ success: false, message: 'Username/ID atau Password salah!' });
        
        res.json({ success: true, data: results[0] });
    });
});

// 3. API Reset Password Pegawai (Dari Admin Dashboard)
app.put('/api/pegawai/reset_password/:id', (req, res) => {
    const id_karyawan = req.params.id;
    const defaultPassword = '123456';
    const hashedPassword = hashPassword(defaultPassword);
    
    // Cek dulu apakah pegawai sudah punya akun portal
    pool.query('SELECT id_karyawan FROM akun_pegawai WHERE LOWER(TRIM(id_karyawan)) = LOWER(TRIM(?))', [id_karyawan], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Pegawai belum memiliki akun portal (Belum Registrasi).' });
        }
        
        // Update password
        pool.query('UPDATE akun_pegawai SET password = ? WHERE LOWER(TRIM(id_karyawan)) = LOWER(TRIM(?))', [hashedPassword, id_karyawan], (err2, result) => {
            if (err2) return res.status(500).json({ success: false, message: 'Gagal mereset password.' });
            
            res.json({ success: true, message: 'Password portal berhasil direset menjadi 123456' });
        });
    });
});

// 4. API Dashboard Pegawai (Data Hari Ini)
app.get('/api/pegawai/dashboard/today/:id', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT jam_masuk, jam_keluar, status, keterangan 
        FROM absensi 
        WHERE id_karyawan = ? AND tanggal = CURDATE()
    `;
    pool.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results[0] || null });
    });
});


// Jalankan Server
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
    console.log(`📂 Buka http://localhost:${port}/admin.html di browser agar suaranya dari AI ini`);

    // [NEW] Deteksi Hari Jumat & Sabtu
    const today = new Date();
    const dayIndex = today.getDay(); // 5 = Jumat, 6 = Sabtu
    const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

    console.log(`\n📅 STATUS HARI INI: ${dayName.toUpperCase()}`);
    if (dayIndex === 5) {
        console.log(`\n🕌 NOTIFIKASI: HARI JUMAT TERDETEKSI (${dayName})`);
        console.log(`   ✅ Server mengenali hari ini adalah Jumat.`);
        console.log(`   🕌 HARI JUMAT TERDETEKSI: Jam Pulang set ke ${JAM_PULANG_JUMAT}`);
    } else if (dayIndex === 6) {
        console.log(`\n🏖️ NOTIFIKASI: HARI SABTU TERDETEKSI (${dayName})`);
        console.log(`   ✅ Server mengenali hari ini adalah Sabtu.`);
        console.log(`   🏖️ HARI SABTU TERDETEKSI: Jam Pulang set ke ${JAM_PULANG_SABTU}`);
    } else {
        console.log(`   🏢 HARI KERJA BIASA: Jam Pulang set ke ${JAM_PULANG_START}`);
    }
});