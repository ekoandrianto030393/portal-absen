const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET /api/rekap?periode=YYYY-MM
    router.get('/', async (req, res) => {
        try {
            if (!pool) {
                throw new Error('Database pool connection is not defined.');
            }
            
            // Ambil parameter periode (YYYY-MM) dari frontend
            const { periode } = req.query;
            
            // Gunakan VIEW yang sudah kita buat di database
            let query = `SELECT * FROM view_rekap_bulanan`;
            const params = [];

            if (periode) {
                query += ' WHERE periode = ?';
                params.push(periode);
            }

            query += ' ORDER BY nama ASC';

            const [rows] = await pool.query(query, params);
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error('Rekap Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
        }
    });

    return router;
};