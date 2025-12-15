// server.js - Biometric Attendance System (Node.js/Express)

const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// --- KONFIGURASI DATABASE ---
const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'biometrik_absensi_wajah_db',
    timezone: '+07:00' // Menggunakan WIB
};
const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARES ---
app.use(express.static(path.resolve(__dirname))); 
app.use(bodyParser.json()); 


// --- 🛑 KONFIGURASI WAKTU KERJA (WIB) & KEAMANAN 🛑 ---

// 1. WAKTU MASUK (7:30)
const JAM_MASUK_START_H =12 ;
const JAM_MASUK_START_M = 46; // Mulai Absen MASUK 5 menit sebelum 7:30
const JAM_MASUK_END_H = 13;
const JAM_MASUK_END_M = 0; // Batas akhir Absen MASUK 15 menit setelah 7:30

// 2. WAKTU PULANG (14:00)
const JAM_PULANG_START_H = 15;
const JAM_PULANG_START_M = 0; // Mulai Absen PULANG 5 menit sebelum 14:00

// 3. DURASI STANDAR untuk Kasus Lupa Absen (7:30 sampai 14:00 = 6.5 jam)
const JAM_KERJA_STANDAR_H = 6.50; 

// 🛑 KONFIGURASI PENGAMANAN WAKTU (TIME GATE)
const MIN_INTERVAL_SECONDS = 60; // Minimal 60 detik antar absensi yang sah


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

// 1. GET: Mengambil descriptor wajah
app.get('/api/get_descriptors', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT id_karyawan, nama, face_descriptor FROM karyawan');
        res.json({ success: true, descriptors: rows });
    } catch (error) {
        console.error('Error mengambil descriptor:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data descriptor.' });
    } finally {
        if (connection) connection.release();
    }
});

// 2. POST: Mendaftar Wajah
app.post('/api/register_face', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id_karyawan, nama, descriptor } = req.body;

        if (!id_karyawan || !nama || !descriptor) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
        }

        const karyawanId = id_karyawan.toUpperCase();
        const descriptorJson = JSON.stringify(descriptor);

        const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM karyawan WHERE id_karyawan = ?', [karyawanId]);
        
        let message;
        if (rows[0].count > 0) {
            // Update jika ID sudah ada
            await connection.execute('UPDATE karyawan SET nama = ?, face_descriptor = ? WHERE id_karyawan = ?', [nama, descriptorJson, karyawanId]);
            message = `Update berhasil: **${nama}**`;
        } else {
            // Insert jika ID belum ada
            await connection.execute('INSERT INTO karyawan (id_karyawan, nama, face_descriptor) VALUES (?, ?, ?)', [karyawanId, nama, descriptorJson]);
            message = `Registrasi berhasil: **${nama}**`;
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error register:', error);
        res.status(500).json({ success: false, message: 'Error Database.' });
    } finally {
        if (connection) connection.release();
    }
});

// 3. POST: Proses Absensi (Dengan Perbaikan Syntax SQL dan Kolom Keterangan)
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
        const [karyawanData] = await connection.execute('SELECT nama FROM karyawan WHERE id_karyawan = ?', [karyawanId]);
        if (karyawanData.length === 0) {
            return res.json({ success: false, message: `ID **${karyawanId}** tidak ditemukan.`, statusColor: 'red' });
        }
        const karyawanName = karyawanData[0].nama;
        
        // --- 🛑 LOGIKA AUTO-FIX LUPA ABSEN (Perbaikan Syntax SQL di sini) ---
        
        // Menggunakan string concatenation (+) untuk menghindari ER_PARSE_ERROR
        const sqlHangingAbsensi = 
            'SELECT waktu_absensi FROM absensi ' +
            'WHERE id_karyawan = ? AND tipe_absensi = \'MASUK\' ' +
            'AND DATE(waktu_absensi) < DATE(NOW()) AND jam_kerja IS NULL ' + 
            'ORDER BY waktu_absensi DESC LIMIT 1';
            
        const [hangingAbsensi] = await connection.execute(sqlHangingAbsensi, [karyawanId]);
        
        // OLD CODE (yang menyebabkan error):
        /*
        const [hangingAbsensi] = await connection.execute(`
            SELECT waktu_absensi 
            FROM absensi 
            WHERE id_karyawan = ? 
              AND tipe_absensi = 'MASUK' 
              AND DATE(waktu_absensi) < DATE(NOW())
              AND jam_kerja IS NULL                 
            ORDER BY waktu_absensi DESC LIMIT 1
        `, [karyawanId]);
        */
        
        if (hangingAbsensi.length > 0) {
            const waktuMasukLama = new Date(hangingAbsensi[0].waktu_absensi);
            const waktuPulangOtomatis = new Date(waktuMasukLama);
            // Set waktu pulang default jam 14:00:00 (Sesuai JAM_KERJA_STANDAR_H)
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
                // 🛑 KRUSIAL: RETURN DI SINI AGAR KODE INSERT DI BAWAH TIDAK DIEKSEKUSI
                return res.json({
                    success: false,
                    message: `Absensi **${karyawanName}** terlalu cepat. Coba lagi dalam ${remainingTime} detik.`,
                    statusColor: 'yellow',
                    karyawanName: karyawanName 
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

                // 🛑 KRUSIAL: RETURN DI SINI
                return res.json({ 
                    success: false, 
                    message: `Absen MASUK Gagal. Diluar jam ${startStr} - ${endStr}.`, 
                    statusColor: 'red' 
                });
            }

            // 🛑 PERBAIKAN KOLOM KETERANGAN
            await connection.execute('INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan) VALUES (?, ?, ?, NULL, ?)', 
                [karyawanId, tipeAbsensiBaru, waktuAbsensi, 'Absen Masuk Normal']);
            
            return res.json({ 
                success: true, 
                message: `✅ **${karyawanName}** Absen MASUK Berhasil. Selamat Bekerja..!`, 
                statusColor: 'green', 
                karyawanName 
            });

        } else if (tipeAbsensiBaru === 'PULANG') {
            // --- LOGIKA PULANG (PENOLAKAN DULU) ---
            
            const targetStartPulang = (JAM_PULANG_START_H * 60) + JAM_PULANG_START_M;

            if (currentTotalMinutes < targetStartPulang) {
                
                if (currentHour >= 10 && currentHour < 12) { 
                    const startStr = `${String(JAM_PULANG_START_H).padStart(2,'0')}:${String(JAM_PULANG_START_M).padStart(2,'0')}`;
                    // 🛑 KRUSIAL: RETURN DI SINI
                    return res.json({ 
                        success: false, 
                        message: `⛔ Absen PULANG Ditolak. Dimulai jam ${startStr}.`, 
                        statusColor: 'red', 
                        karyawanName 
                    });
                }

                // Fake Success untuk jam kerja normal (di antara waktu masuk dan waktu penolakan keras)
                return res.json({ 
                    success: true, 
                    message: `Absen MASUK telah tercatat. Anda sedang dalam masa kerja.`, 
                    statusColor: 'green', 
                    karyawanName 
                });
            }

            // --- LOGIKA ABSEN PULANG (NORMAL - INSERT) ---
            if (lastMasukTime) {
                const diff_ms = currentTime.getTime() - new Date(lastMasukTime).getTime();
                const jamKerja = (diff_ms / (1000 * 60 * 60)).toFixed(2);

                // Absen PULANG menyertakan kolom 'keterangan' dengan nilai NULL
                await connection.execute('INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja, keterangan) VALUES (?, ?, ?, ?, NULL)', 
                    [karyawanId, tipeAbsensiBaru, waktuAbsensi, jamKerja]);
                
                return res.json({ 
                    success: true, 
                    message: `✅ Absensi PULANG Berhasil: **${karyawanName}**. Total jam kerja hari ini: ${jamKerja} Jam`, 
                    statusColor: 'green', 
                    karyawanName 
                });
            }
        }

        // Jika sampai sini, ada kondisi tidak terduga
        res.json({ success: false, message: 'Proses Absensi Tidak Valid', statusColor: 'red', karyawanName, karyawanId });

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
        let whereClause = '';

        if (periodeFilter && periodeFilter.length === 7 && periodeFilter.includes('-')) {
            const [tahun, bulan] = periodeFilter.split('-');
            whereClause = `WHERE Tahun = ${mysql.escape(tahun)} AND Bulan = ${mysql.escape(parseInt(bulan))}`;
        }

        // Query ini mengandalkan VIEW bernama rekap_gaji_bulanan
        const sql = `
            SELECT 
                id_karyawan, 
                nama, 
                CONCAT(Tahun, '-', LPAD(Bulan, 2, '0')) AS periode_bulan,
                Total_Jam_Kerja AS total_jam_kerja_decimal,
                SEC_TO_TIME(Total_Jam_Kerja * 3600) AS total_jam_kerja_hms 
            FROM rekap_gaji_bulanan
            ${whereClause}
            ORDER BY Tahun DESC, Bulan DESC, id_karyawan ASC;`;
        
        const [rows] = await connection.execute(sql);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Rekap Data Error:', e);
        res.status(500).json({ success: false, message: 'Gagal memuat rekap data. Pastikan VIEW rekap_gaji_bulanan sudah dibuat.' });
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
        res.status(500).json({ success: false, message: 'Gagal memuat daftar periode. Pastikan VIEW rekap_gaji_bulanan sudah dibuat.' });
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
    console.log('===================================================\n');
});