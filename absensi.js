const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // POST /api/absensi
    router.post('/', async (req, res) => {
        const { id_karyawan } = req.body;
        const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        const now = new Date().toLocaleTimeString('id-ID', { hour12: false }); // Format HH:mm:ss

        try {
            // 1. Cek Data Karyawan
            const [karyawan] = await pool.query('SELECT nama, jabatan FROM karyawan WHERE id_karyawan = ?', [id_karyawan]);
            if (karyawan.length === 0) {
                return res.status(404).json({ success: false, message: 'Data karyawan tidak ditemukan.', statusColor: 'red' });
            }
            const { nama, jabatan } = karyawan[0];

            // 2. Cek apakah sudah absen hari ini
            const [absensi] = await pool.query('SELECT * FROM absensi WHERE id_karyawan = ? AND tanggal = ?', [id_karyawan, today]);

            if (absensi.length === 0) {
                // --- LOGIKA CHECK-IN ---
                await pool.query('INSERT INTO absensi (id_karyawan, tanggal, jam_masuk, status) VALUES (?, ?, ?, ?)', 
                    [id_karyawan, today, now, 'Hadir']);
                
                return res.json({ 
                    success: true, 
                    result_code: 'CHECK_IN_SUCCESS',
                    message: `Selamat Pagi, ${nama}. Absensi Masuk berhasil.`,
                    nama, jabatan, statusColor: 'green' 
                });

            } else {
                const dataAbsen = absensi[0];

                if (!dataAbsen.jam_keluar) {
                    // --- LOGIKA CHECK-OUT ---
                    
                    // [NEW] Cek Jam Pulang dari .env
                    const jamPulangStart = process.env.JAM_PULANG_START;
                    if (jamPulangStart) {
                        // Logika shift malam (Start 19:30, Pulang 00:20)
                        // Jika jamPulangStart kecil (misal < 08:00), anggap shift lintas hari
                        const isNightShift = jamPulangStart < '08:00:00';
                        
                        let isTooEarly = false;
                        if (isNightShift) {
                            // Terlalu awal jika:
                            // 1. Masih hari sebelumnya (jam besar, misal 23:50)
                            // 2. Sudah hari berikutnya tapi belum jam pulang (misal 00:10)
                            // Asumsi batas hari sebelumnya adalah > 12:00 siang
                            if (now > '12:00:00' || now < jamPulangStart) {
                                isTooEarly = true;
                            }
                        } else {
                            // Shift normal (pagi-sore), jam pulang > jam masuk
                            if (now < jamPulangStart) {
                                isTooEarly = true;
                            }
                        }

                        if (isTooEarly) {
                             return res.json({ 
                                success: false, 
                                result_code: 'TOO_EARLY_OUT',
                                message: `Belum waktunya pulang. Jam pulang mulai: ${jamPulangStart}`,
                                nama, jabatan, statusColor: 'yellow' 
                            });
                        }
                    }

                    await pool.query('UPDATE absensi SET jam_keluar = ? WHERE id_absensi = ?', [now, dataAbsen.id_absensi]);
                    
                    return res.json({ 
                        success: true, 
                        result_code: 'CHECK_OUT_SUCCESS',
                        message: `Sampai Jumpa, ${nama}. Absensi Pulang berhasil.`,
                        nama, jabatan, statusColor: 'green' 
                    });
                } else {
                    // --- SUDAH PULANG (DUPLICATE) ---
                    return res.json({ 
                        success: true, 
                        result_code: 'ALREADY_CHECKED_OUT',
                        message: `Anda sudah melakukan absensi pulang hari ini.`,
                        nama, jabatan, statusColor: 'yellow' 
                    });
                }
            }
        } catch (error) {
            console.error('Absensi Error:', error);
            res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memproses absensi.', statusColor: 'red' });
        }
    });

    return router;
};