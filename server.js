
// ===================================================
// server.js — Biometric Attendance System (FINAL)
// ===================================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MIN_ABSENSI_INTERVAL = parseInt(process.env.MIN_ABSENSI_INTERVAL || '1'); // Default: Jeda 1 menit antar absen
const AUTO_FIX_JAM_KERJA = 7.0; // KONFIGURASI: Jam kerja otomatis jika lupa absen pulang

// ===================================================
// DATABASE CONFIG (XAMPP / Laragon)
// ===================================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'biometrik_absensi_wajah_db',
    timezone: '+07:00',
    waitForConnections: true,
    connectionLimit: 10
});

// ===================================================
// MIDDLEWARE (WAJIB URUTAN INI)
// ===================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// bodyParser lama (TIDAK DIHAPUS)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// static files (admin.html, scan.html, admin.js, scan.js, models/)
app.use(express.static(path.join(__dirname)));

// anti favicon error
app.use((req, res, next) => {
    if (req.originalUrl === '/favicon.ico') return res.sendStatus(204);
    next();
});

// ===================================================
// ROUTE: KARYAWAN (ADMIN + REGISTER FACE)
// ===================================================
const karyawanRoutes = require('./karyawan.js')(pool);
app.use('/api/karyawan', karyawanRoutes);
console.log('🔥 /api/karyawan ROUTE TERPASANG');

// ===================================================
// ROUTE: REGISTER (Dari admin.html)
// ===================================================
app.post('/register', async (req, res) => {
    const { id_karyawan, nama, jabatan, face_descriptor, foto } = req.body;

    let conn;
    try {
        conn = await pool.getConnection();
        const query = `
            INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto) 
            VALUES (?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            nama = VALUES(nama), 
            jabatan = VALUES(jabatan), 
            face_descriptor = VALUES(face_descriptor),
            foto = VALUES(foto)
        `;
        await conn.execute(query, [id_karyawan, nama, jabatan, face_descriptor, foto]);
        res.json({ success: true, message: "Registrasi Berhasil" });
    } catch (err) {
        console.error("[REGISTER ERROR]", err);
        res.status(500).json({ success: false, message: "Gagal menyimpan ke database." });
    } finally {
        if (conn) conn.release();
    }
});

// ===================================================
// ROUTE: GET DESCRIPTORS (UNTUK scan.js)
// ===================================================
app.get('/get-descriptors', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.execute(`
            SELECT id_karyawan, nama, jabatan, face_descriptor
            FROM karyawan
            WHERE face_descriptor IS NOT NULL
        `);

        const descriptors = rows.map(r => ({
            id_karyawan: r.id_karyawan,
            nama: r.nama,
            jabatan: r.jabatan,
            face_descriptor: r.face_descriptor // ⛔ TIDAK JSON.parse
        }));

        res.json({ success: true, descriptors });

    } catch (err) {
        console.error('Get Descriptors Error:', err);
        res.status(500).json({ success: false, message: 'Gagal memuat data wajah' });
    } finally {
        if (conn) conn.release();
    }
});

// ===================================================
// ROUTE: ABSENSI (scan.html)
// ===================================================
app.post('/absensi', async (req, res) => {
    const { id_karyawan } = req.body;
    if (!id_karyawan) {
        return res.status(400).json({ success: false, message: 'ID karyawan wajib' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        const now = new Date();
        // FIX: Gunakan waktu lokal WIB (Asia/Jakarta) untuk database agar sesuai jam dinding
        const waktu = now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace('T', ' ');

        const [last] = await conn.execute(`
            SELECT tipe_absensi, waktu_absensi
            FROM absensi
            WHERE id_karyawan = ?
            ORDER BY waktu_absensi DESC
            LIMIT 1
        `, [id_karyawan]);

        let tipe = 'MASUK';
        let jamKerja = null;

        if (last.length > 0) {
            // Ambil waktu terakhir (Driver mysql2 otomatis handle Date object)
            const lastTime = new Date(last[0].waktu_absensi);
            const diffMs = now - lastTime;
            const diffMinutes = diffMs / 60000;
            
            // FIX: Cek tanggal berdasarkan Zona Waktu Jakarta (WIB)
            // Ini mencegah bug di mana jam 06:00 pagi dianggap hari kemarin karena UTC
            const checkDate = (d) => d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
            const lastDate = checkDate(lastTime);
            const todayDate = checkDate(now);

            // 1. CEK INTERVAL (Pencegahan Spam/Duplikasi)
            // Hanya berlaku jika absen dilakukan di hari yang sama
            if (lastDate === todayDate && diffMinutes < MIN_ABSENSI_INTERVAL) {
                return res.json({
                    success: false,
                    message: `Tunggu ${Math.ceil(MIN_ABSENSI_INTERVAL - diffMinutes)} menit lagi untuk absen.`,
                    statusColor: 'yellow', // Sinyal peringatan ke frontend
                    result_code: 'COOLDOWN_ACTIVE'
                });
            }

            // 2. CEK LIMIT HARIAN (Mencegah Siklus Baru setelah Pulang)
            if (last[0].tipe_absensi === 'PULANG' && lastDate === todayDate) {
                return res.json({
                    success: false,
                    message: 'Anda sudah absen PULANG hari ini. Sampai jumpa besok.',
                    statusColor: 'red',
                    result_code: 'DAILY_LIMIT_REACHED'
                });
            }

            // 3. LOGIKA TOGGLE (Masuk -> Pulang) DENGAN RESET HARIAN
            // Jika status terakhir MASUK dan tanggalnya HARI INI, maka sekarang PULANG.
            // Jika status terakhir MASUK tapi tanggal KEMARIN, maka sekarang dianggap MASUK baru (Reset).
            if (last[0].tipe_absensi === 'MASUK' && lastDate === todayDate) {
                tipe = 'PULANG';
                const diffHours = diffMs / 3600000; // Hitung jam kerja dengan akurat
                jamKerja = diffHours.toFixed(2);
            } else if (last[0].tipe_absensi === 'MASUK' && lastDate !== todayDate) {
                // --- AUTO FIX LUPA PULANG (Limit 1x per kejadian) ---
                // Jika status terakhir MASUK tapi beda hari, berarti lupa absen pulang kemarin.
                // Sistem otomatis mencatat PULANG untuk kemarin dengan jam kerja 6.5 jam.
                
                const autoOutTime = new Date(lastTime.getTime() + (AUTO_FIX_JAM_KERJA * 60 * 60 * 1000)); // Masuk + X jam
                const autoOutTimeStr = autoOutTime.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace('T', ' ');

                await conn.execute(`
                    INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan)
                    VALUES (?, 'PULANG', ?, ?, 'AUTO_FIX_SYSTEM')
                `, [id_karyawan, autoOutTimeStr, AUTO_FIX_JAM_KERJA]);
            }
        }

        // 4. VALIDASI JAM KERJA (STRICT TIME WINDOW)
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const timeDecimal = currentHour + (currentMinute / 60); // Contoh: 08:30 jadi 8.5

        if (tipe === 'MASUK') {
            // Aturan: Masuk hanya boleh 07:00 (7.0) s/d 08:30 (8.5)
            if (timeDecimal < 12.0 || timeDecimal > 12.51) {
                return res.json({
                    success: false,
                    message: `Gagal: Absen Masuk hanya pukul 12:00 - 14:00.`,
                    statusColor: 'red',
                    result_code: 'OUT_OF_WINDOW'
                });
            }
        } else if (tipe === 'PULANG') {
            // Aturan: Pulang hanya boleh setelah 14:00 (14.0)
            if (timeDecimal < 12.52) {
                return res.json({
                    success: false,
                    message: `Gagal: Belum waktunya pulang (Min 14:00).`,
                    statusColor: 'yellow',
                    result_code: 'TOO_EARLY'
                });
            }
        }

        await conn.execute(`
            INSERT INTO absensi
            (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja)
            VALUES (?, ?, ?, ?)
        `, [id_karyawan, tipe, waktu, jamKerja]);

        res.json({
            success: true,
            message: `Absensi ${tipe} berhasil`
        });

    } catch (err) {
        console.error('Absensi Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

// ===================================================
// REKAP DATA BULANAN
// ===================================================
app.get('/api/rekap_data', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.execute(`
            SELECT *
            FROM rekap_gaji_bulanan
            ORDER BY Tahun DESC, Bulan DESC, id_karyawan ASC
        `);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false });
    } finally {
        if (conn) conn.release();
    }
});

// ===================================================
// MONITORING (VIEW status_absensi_harian)
// ===================================================
app.get('/api/monitoring/lupa_pulang', async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT id_karyawan, nama, COUNT(*) total
        FROM status_absensi_harian
        WHERE is_lupa_pulang = 1
        GROUP BY id_karyawan, nama
    `);
    res.json({ success: true, data: rows });
});

app.get('/api/monitoring/terlambat_lengkap', async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT id_karyawan, nama, COUNT(*) total
        FROM status_absensi_harian
        WHERE is_terlambat_masuk = 1 AND is_lupa_pulang = 0
        GROUP BY id_karyawan, nama
    `);
    res.json({ success: true, data: rows });
});

app.get('/api/monitoring/terlambat_lupa', async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT id_karyawan, nama, COUNT(*) total
        FROM status_absensi_harian
        WHERE is_terlambat_masuk = 1 AND is_lupa_pulang = 1
        GROUP BY id_karyawan, nama
    `);
    res.json({ success: true, data: rows });
});

// ===================================================
// STATIC ROUTES
// ===================================================
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'index.html'))
);
app.get('/scan', (req, res) =>
    res.sendFile(path.join(__dirname, 'scan.html'))
);
app.get('/admin', (req, res) =>
    res.sendFile(path.join(__dirname, 'admin.html'))
);

// ===================================================
// START SERVER
// ===================================================

// Cek Koneksi Database saat Startup
pool.getConnection()
    .then(conn => {
        console.log("✅ DATABASE CONNECTED SUCCESSFULLY");
        conn.release();
    })
    .catch(err => console.error("❌ DATABASE CONNECTION FAILED:", err.message));

app.listen(PORT, '0.0.0.0', () => {
    console.log('====================================');
    console.log('🚀 BIOMETRIC SERVER RUNNING');
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('====================================');
});
