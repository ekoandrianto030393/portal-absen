const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET /api/monitoring/stats (Ringkasan Statistik Hari Ini)
    router.get('/stats', async (req, res) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const [totalKaryawan] = await pool.query('SELECT COUNT(*) as count FROM karyawan');
            const [hadir] = await pool.query('SELECT COUNT(*) as count FROM absensi WHERE tanggal = ?', [today]);
            const [pulang] = await pool.query('SELECT COUNT(*) as count FROM absensi WHERE tanggal = ? AND jam_keluar IS NOT NULL', [today]);

            res.json({
                success: true,
                stats: {
                    total_karyawan: totalKaryawan[0].count,
                    hadir: hadir[0].count,
                    pulang: pulang[0].count,
                    belum_hadir: totalKaryawan[0].count - hadir[0].count
                }
            });
        } catch (error) {
            console.error('Monitoring Stats Error:', error);
            res.status(500).json({ success: false, message: 'Error server.' });
        }
    });

    // GET /api/monitoring/live (Daftar Absensi Hari Ini Realtime)
    router.get('/live', async (req, res) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [rows] = await pool.query(`
                SELECT k.nama, k.jabatan, a.jam_masuk, a.jam_keluar, a.status, k.foto
                FROM absensi a
                JOIN karyawan k ON a.id_karyawan = k.id_karyawan
                WHERE a.tanggal = ?
                ORDER BY a.jam_masuk DESC
            `, [today]);
            
            // Convert foto blob to base64 agar bisa tampil di frontend
            const data = rows.map(row => {
                if (row.foto) row.foto = `data:image/jpeg;base64,${Buffer.from(row.foto).toString('base64')}`;
                return row;
            });

            res.json({ success: true, data });
        } catch (error) {
            console.error('Monitoring Live Error:', error);
            res.status(500).json({ success: false, message: 'Error server.' });
        }
    });

    return router;
};