// server.js - Biometric Attendance System (Node.js/Express)

require('dotenv').config(); // Muat variabel dari file .env
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- KONFIGURASI DATABASE (dari .env) ---
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: process.env.DB_TIMEZONE
};
const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARES ---
app.use(express.static(path.resolve(__dirname))); 
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Middleware untuk mengabaikan permintaan favicon.ico agar tidak error 404 di log
app.use((req, res, next) => {
    if (req.originalUrl === '/favicon.ico') return res.status(204).send();
    next();
});


// --- 🛑 KONFIGURASI WAKTU KERJA (WIB) & KEAMANAN 🛑 ---
// Nilai sekarang diambil dari file .env, dengan fallback jika tidak ada
const JAM_MASUK_START_H = parseInt(process.env.JAM_MASUK_START_H || '7');
const JAM_MASUK_START_M = parseInt(process.env.JAM_MASUK_START_M || '25');
const JAM_MASUK_END_H = parseInt(process.env.JAM_MASUK_END_H || '7');
const JAM_MASUK_END_M = parseInt(process.env.JAM_MASUK_END_M || '45');
const JAM_PULANG_START_H = parseInt(process.env.JAM_PULANG_START_H || '14');
const JAM_PULANG_START_M = parseInt(process.env.JAM_PULANG_START_M || '0');
const JAM_KERJA_STANDAR_H = parseFloat(process.env.JAM_KERJA_STANDAR_H || '6.5');
const MIN_INTERVAL_SECONDS = parseInt(process.env.MIN_INTERVAL_SECONDS || '60');


// --- FUNGSI UTILITAS WAKTU ---
function toSqlDatetime(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getStartOfDaySQL(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} 00:00:00`;
}

// --- ENDPOINT API ---

// Impor dan gunakan rute dari file terpisah
const karyawanRoutes = require('./karyawan.js')(pool);
app.use('/api/karyawan', karyawanRoutes);

// 2. GET: Ambil Descriptors Wajah (Untuk Face-API)
app.get('/get-descriptors', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT id_karyawan, nama, jabatan, foto, face_descriptor FROM karyawan WHERE face_descriptor IS NOT NULL');
        
        const descriptors = rows.map(row => ({
            ...row,
            // Convert BLOB to Data URI for frontend usage
            foto: row.foto ? `data:image/jpeg;base64,${Buffer.from(row.foto).toString('base64')}` : null
        }));

        res.json({ success: true, descriptors });
    } catch (error) {
        console.error('Get Descriptors Error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data wajah.' });
    } finally {
        if (connection) connection.release();
    }
});

// 3. POST: Proses Absensi 
app.post('/absensi', async (req, res) => {
    let connection;
    try {
        const { id_karyawan } = req.body;
        
        if (!id_karyawan) return res.status(400).json({ success: false, message: 'ID Invalid.' });
        
        const karyawanId = id_karyawan.toUpperCase();

        connection = await pool.getConnection();

        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const currentTotalMinutes = (currentHour * 60) + currentMinute;

        const waktuAbsensi = toSqlDatetime(currentTime);
        const startOfDaySQL = getStartOfDaySQL(currentTime);

        // A. Cek Karyawan
        const [karyawanData] = await connection.execute('SELECT nama, jabatan, foto FROM karyawan WHERE id_karyawan = ?', [karyawanId]);
        if (karyawanData.length === 0) {
            return res.json({ success: false, message: `ID **${karyawanId}** tidak ditemukan.`, statusColor: 'red' });
        }
        const { nama: karyawanName, jabatan: karyawanJabatan, foto: karyawanFoto } = karyawanData[0];
        // Konversi foto ke base64 untuk dikirim via JSON
        const fotoBase64 = karyawanFoto ? Buffer.from(karyawanFoto).toString('base64') : null;

        // --- 🛑 LOGIKA AUTO-FIX LUPA ABSEN ---
        
        // Query untuk mencari Absensi MASUK kemarin atau hari sebelumnya yang belum ada Absen PULANG hari itu.
        const sqlHangingAbsensi = 
            'SELECT waktu_absensi FROM absensi ' +
            'WHERE id_karyawan = ? ' +
            'AND tipe_absensi = \'MASUK\' ' +
            'AND DATE(waktu_absensi) < DATE(NOW()) ' + 
            'AND jam_kerja IS NULL ' + 
            'ORDER BY waktu_absensi DESC LIMIT 1';
            
        const [hangingAbsensi] = await connection.execute(sqlHangingAbsensi, [karyawanId]);
        
        
        if (hangingAbsensi.length > 0) {
            const waktuMasukLama = new Date(hangingAbsensi[0].waktu_absensi);
            const waktuPulangOtomatis = new Date(waktuMasukLama);
            // Set waktu pulang default jam 14:00:00 
            waktuPulangOtomatis.setHours(14, 0, 0); 
            const waktuPulangDefaultSQL = toSqlDatetime(waktuPulangOtomatis);
            const jamKerjaDefault = JAM_KERJA_STANDAR_H.toFixed(2);
            
            // INSERT ABSEN PULANG OTOMATIS (menyertakan keterangan)
            await connection.execute('INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan) VALUES (?, ?, ?, ?, ?)', 
                [karyawanId, 'PULANG', waktuPulangDefaultSQL, jamKerjaDefault, `Otomatis: Lupa Absen Pulang (Set to ${jamKerjaDefault} Jam)`]);
            
            console.log(`[LUPA ABSEN AUTO-FIX] Karyawan ${karyawanId} dicatat PULANG Otomatis (${jamKerjaDefault} jam) pada ${waktuPulangDefaultSQL}`);
        }
        // --- AKHIR LOGIKA LUPA ABSEN ---


        // B. Cek Status Absensi Terakhir Hari Ini
        const [lastAbsensi] = await connection.execute(
            'SELECT tipe_absensi, waktu_absensi FROM absensi WHERE id_karyawan = ? AND waktu_absensi >= ? ORDER BY waktu_absensi DESC LIMIT 1',
            [karyawanId, startOfDaySQL]
        );

        // --- 🛑 LOGIKA PENGAMANAN WAKTU (TIME GATE) ---
        if (lastAbsensi.length > 0) {
            const lastAbsensiTime = new Date(lastAbsensi[0].waktu_absensi);
            const timeDifferenceMs = currentTime.getTime() - lastAbsensiTime.getTime();
            const timeDifferenceSeconds = timeDifferenceMs / 1000;

            if (timeDifferenceSeconds < MIN_INTERVAL_SECONDS) {
                const remainingTime = MIN_INTERVAL_SECONDS - Math.floor(timeDifferenceSeconds);
                return res.json({
                    success: false, // Diganti success: false untuk memicu overlay DENIED (merah), tapi statusColor kuning
                    message: `Absensi **${karyawanName}** terlalu cepat. Coba lagi dalam ${remainingTime} detik.`,
                    statusColor: 'yellow',
                    result_code: 'TOO_SOON',
                    nama: karyawanName,
                    jabatan: karyawanJabatan,
                    foto: fotoBase64
                });
            }
        }
        // --- AKHIR LOGIKA PENGAMANAN WAKTU ---


        let tipeAbsensiBaru;
        let lastMasukTime = null;

        if (lastAbsensi.length === 0 || lastAbsensi[0].tipe_absensi === 'PULANG') {
            tipeAbsensiBaru = 'MASUK';
        } else {
            tipeAbsensiBaru = 'PULANG'; 
            lastMasukTime = lastAbsensi[0].waktu_absensi;
        }

        // C. Validasi Waktu & Insert
        if (tipeAbsensiBaru === 'MASUK') {
            // --- LOGIKA ABSEN MASUK ---
            const targetStart = (JAM_MASUK_START_H * 60) + JAM_MASUK_START_M;
            const targetEnd = (JAM_MASUK_END_H * 60) + JAM_MASUK_END_M;

            if (currentTotalMinutes < targetStart || currentTotalMinutes > targetEnd) {
                const startStr = `${String(JAM_MASUK_START_H).padStart(2,'0')}:${String(JAM_MASUK_START_M).padStart(2,'0')}`;
                const endStr = `${String(JAM_MASUK_END_H).padStart(2,'0')}:${String(JAM_MASUK_END_M).padStart(2,'0')}`;

                return res.json({ 
                    success: false, 
                    message: `Absen MASUK Gagal. Diluar jam ${startStr} - ${endStr}.`, 
                    statusColor: 'red',
                    result_code: 'OUT_OF_TIME_IN',
                    nama: karyawanName,
                    jabatan: karyawanJabatan,
                    foto: fotoBase64
                });
            }

            // INSERT Absen Masuk Normal (jam_kerja NULL)
            await connection.execute('INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan) VALUES (?, ?, ?, NULL, ?)', 
                [karyawanId, tipeAbsensiBaru, waktuAbsensi, 'Absen Masuk Normal']);
            
            // 🛑 PENYESUAIAN 1: Pesan harus mengandung 'telah tercatat' untuk memicu tampilan kustom di scan.js
            return res.json({ 
                success: true, 
                message: `✅ Absensi MASUK atas nama **${karyawanName}** telah tercatat.`, // Pemicu tampilan kustom Absen Masuk Pertama
                statusColor: 'green', 
                result_code: 'CHECK_IN_SUCCESS',
                nama: karyawanName,
                jabatan: karyawanJabatan,
                foto: fotoBase64
            });

        } else if (tipeAbsensiBaru === 'PULANG') {
            // --- LOGIKA PULANG (PENOLAKAN DULU) ---
            
            const targetStartPulang = (JAM_PULANG_START_H * 60) + JAM_PULANG_START_M;

            if (currentTotalMinutes < targetStartPulang) {
                
                if (currentHour >= 10 && currentHour < 12) { 
                    const startStr = `${String(JAM_PULANG_START_H).padStart(2,'0')}:${String(JAM_PULANG_START_M).padStart(2,'0')}`;
                    return res.json({ 
                        success: false, 
                        message: `⛔ Absen PULANG Ditolak. Dimulai jam ${startStr}.`, 
                        statusColor: 'red', 
                        result_code: 'TOO_EARLY_OUT',
                        nama: karyawanName,
                        jabatan: karyawanJabatan,
                        foto: fotoBase64
                    });
                }

                // Fake Success untuk jam kerja normal 
                // 🛑 PENYESUAIAN 2: Gunakan statusColor 'yellow' untuk 'Absen Lanjutan/Konfirmasi Ulang' 
                return res.json({ 
                    success: true, 
                    message: `Absen MASUK telah tercatat. Anda sedang dalam masa kerja.`, // Pemicu Absen Lanjutan
                    statusColor: 'yellow', 
                    result_code: 'STATUS_CONFIRMED',
                    nama: karyawanName,
                    jabatan: karyawanJabatan,
                    foto: fotoBase64
                });
            }

            // --- LOGIKA ABSEN PULANG (NORMAL - INSERT) ---
            if (lastMasukTime) {
                const diff_ms = currentTime.getTime() - new Date(lastMasukTime).getTime();
                const jamKerja = (diff_ms / (1000 * 60 * 60)).toFixed(2);

                // Absen PULANG menyertakan kolom 'keterangan' dengan nilai NULL
                await connection.execute('INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan) VALUES (?, ?, ?, ?, NULL)', 
                    [karyawanId, tipeAbsensiBaru, waktuAbsensi, jamKerja]);
                
                // 🛑 PENYESUAIAN 3: Pesan harus mengandung 'telah tercatat' dan 'PULANG' untuk memicu tampilan kustom Absen Pulang
                return res.json({ 
                    success: true, 
                    message: `✅ Absensi PULANG atas nama **${karyawanName}** telah tercatat. Total jam kerja: ${jamKerja} Jam`, 
                    statusColor: 'green', 
                    result_code: 'CHECK_OUT_SUCCESS',
                    nama: karyawanName,
                    jabatan: karyawanJabatan,
                    foto: fotoBase64
                });
            }
        }

        res.json({ success: false, message: 'Proses Absensi Tidak Valid', statusColor: 'red', nama: karyawanName, jabatan: karyawanJabatan, foto: fotoBase64 });

    } catch (error) {
        console.error('Absensi Error:', error);
        res.status(500).json({ success: false, message: 'Server Error. Cek Log Terminal!', statusColor: 'red' });
    } finally {
        if (connection) connection.release();
    }
});


// 4. GET: Rekap Data API
app.get('/api/rekap_data', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        const periodeFilter = req.query.periode;
        let sql = `
            SELECT 
                id_karyawan, 
                nama, 
                CONCAT(Tahun, '-', LPAD(Bulan, 2, '0')) AS periode_bulan,
                Total_Jam_Kerja AS total_jam_kerja_decimal,
                SEC_TO_TIME(Total_Jam_Kerja * 3600) AS total_jam_kerja_hms 
            FROM rekap_gaji_bulanan
        `;
        const params = [];

        if (periodeFilter && periodeFilter.length === 7 && periodeFilter.includes('-')) {
            const [tahun, bulan] = periodeFilter.split('-');
            sql += ' WHERE Tahun = ? AND Bulan = ?';
            params.push(tahun, parseInt(bulan));
        }

        sql += ' ORDER BY Tahun DESC, Bulan DESC, id_karyawan ASC;';
        
        const [rows] = await connection.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Rekap Data Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat rekap data.' });
    } finally {
        if (connection) connection.release();
    }
});


// 5. GET: Endpoint untuk Mengambil Semua Periode Unik
app.get('/api/rekap_all_periodes', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT DISTINCT 
                CONCAT(Tahun, '-', LPAD(Bulan, 2, '0')) AS periode_bulan
            FROM rekap_gaji_bulanan
            ORDER BY Tahun DESC, Bulan DESC;`;
        
        const [rows] = await connection.execute(sql);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Rekap All Periodes Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat daftar periode.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- ENDPOINT MONITORING KEDISIPLINAN (Menggunakan VIEW status_absensi_harian) ---

// 6. GET: Monitoring Lupa Absen Pulang (LUPA PULANG)
app.get('/api/monitoring/lupa_pulang', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const periodeFilter = req.query.periode; 
        const sql = `
            SELECT 
                id_karyawan, 
                nama, 
                COUNT(*) AS total_lupa_pulang
            FROM status_absensi_harian
            WHERE is_lupa_pulang = 1 
            ${periodeFilter ? 'AND YEAR(tanggal) = ? AND MONTH(tanggal) = ?' : ''}
            GROUP BY id_karyawan, nama
            ORDER BY total_lupa_pulang DESC;
        `;

        const params = [];
        if (periodeFilter && periodeFilter.length === 7 && periodeFilter.includes('-')) {
            const [tahun, bulan] = periodeFilter.split('-');
            params.push(tahun, parseInt(bulan));
        }
        
        const [rows] = await connection.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Monitoring Lupa Pulang Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat data monitoring lupa pulang.' });
    } finally {
        if (connection) connection.release();
    }
});

// 7. GET: Monitoring Sering Terlambat Masuk (LENGKAP PULANG)
app.get('/api/monitoring/terlambat_lengkap', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const periodeFilter = req.query.periode; 
        const sql = `
            SELECT 
                id_karyawan, 
                nama, 
                COUNT(*) AS total_terlambat_lengkap
            FROM status_absensi_harian
            WHERE is_terlambat_masuk = 1 AND is_lupa_pulang = 0
            ${periodeFilter ? 'AND YEAR(tanggal) = ? AND MONTH(tanggal) = ?' : ''}
            GROUP BY id_karyawan, nama
            ORDER BY total_terlambat_lengkap DESC;
        `;

        const params = [];
        if (periodeFilter && periodeFilter.length === 7 && periodeFilter.includes('-')) {
            const [tahun, bulan] = periodeFilter.split('-');
            params.push(tahun, parseInt(bulan));
        }
        
        const [rows] = await connection.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Monitoring Terlambat Lengkap Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat data monitoring terlambat lengkap.' });
    } finally {
        if (connection) connection.release();
    }
});

// 8. GET: Monitoring Terlambat Masuk DAN Lupa Absen Pulang (KASUS TERBURUK)
app.get('/api/monitoring/terlambat_lupa', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const periodeFilter = req.query.periode; 
        const sql = `
            SELECT 
                id_karyawan, 
                nama, 
                COUNT(*) AS total_terlambat_lupa
            FROM status_absensi_harian
            WHERE is_terlambat_masuk = 1 AND is_lupa_pulang = 1
            ${periodeFilter ? 'AND YEAR(tanggal) = ? AND MONTH(tanggal) = ?' : ''}
            GROUP BY id_karyawan, nama
            ORDER BY total_terlambat_lupa DESC;
        `;

        const params = [];
        if (periodeFilter && periodeFilter.length === 7 && periodeFilter.includes('-')) {
            const [tahun, bulan] = periodeFilter.split('-');
            params.push(tahun, parseInt(bulan));
        }
        
        const [rows] = await connection.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Monitoring Terlambat Lupa Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat data monitoring terlambat dan lupa pulang.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- MENJALANKAN SERVER ---
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n===================================================');
    console.log(`🚀  SYSTEM ONLINE: BIOMETRIC SERVER ACTIVE`);
    console.log('===================================================');
    console.log(`👉  SERVER ADDRESS   : http://localhost:${PORT}`);
    console.log('---------------------------------------------------');
    console.log(`⚙️  ADMIN REGISTRASI : http://localhost:${PORT}/admin.html`);
    console.log(`📷  ABSENSI TERMINAL : http://localhost:${PORT}/scan.html`);
    console.log(`📊  REKAP DATA       : http://localhost:${PORT}/rekap.html`); 
    console.log(`🚨  MONITORING       : http://localhost:${PORT}/monitor.html`); 
    console.log('===================================================\n');
});