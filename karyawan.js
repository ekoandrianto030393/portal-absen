const express = require('express');
const router = express.Router();

module.exports = (pool) => {

    // GET: Mengambil semua descriptor wajah untuk inisialisasi
    router.get('/get_descriptors', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute('SELECT id_karyawan, nama, jabatan, face_descriptor, foto FROM karyawan');
            
            rows.forEach(row => {
                if (row.foto) {
                    row.foto = `data:image/jpeg;base64,${Buffer.from(row.foto).toString('base64')}`;
                }
            });
            res.json({ success: true, descriptors: rows });
        } catch (error) {
            console.error('Error mengambil descriptor:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil data descriptor.' });
        } finally {
            if (connection) connection.release();
        }
    });

    // POST: Mendaftar atau memperbarui wajah
    router.post('/register_face', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const { id_karyawan, nama, jabatan, descriptor, foto } = req.body;

            if (!id_karyawan || !nama || !jabatan || !descriptor) {
                return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
            }

            const karyawanId = id_karyawan.toUpperCase();
            const descriptorJson = JSON.stringify(descriptor);
            
            let fotoBuffer = null;
            if (foto) {
                const base64Data = foto.replace(/^data:image\/[a-z]+;base64,/, "");
                fotoBuffer = Buffer.from(base64Data, 'base64');
            }

            const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM karyawan WHERE id_karyawan = ?', [karyawanId]);
            
            let message;
            if (rows[0].count > 0) {
                const sql = fotoBuffer 
                    ? 'UPDATE karyawan SET nama = ?, jabatan = ?, face_descriptor = ?, foto = ? WHERE id_karyawan = ?'
                    : 'UPDATE karyawan SET nama = ?, jabatan = ?, face_descriptor = ? WHERE id_karyawan = ?';
                const params = fotoBuffer 
                    ? [nama, jabatan, descriptorJson, fotoBuffer, karyawanId]
                    : [nama, jabatan, descriptorJson, karyawanId];
                await connection.execute(sql, params);
                message = `Update berhasil: **${nama}**`;
            } else {
                await connection.execute(
                    'INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto) VALUES (?, ?, ?, ?, ?)', 
                    [karyawanId, nama, jabatan, descriptorJson, fotoBuffer]
                );
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

    // GET: Mengambil detail satu karyawan
    router.get('/:id', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute('SELECT id_karyawan, nama, jabatan, foto FROM karyawan WHERE id_karyawan = ?', [req.params.id]);

            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

            const karyawan = rows[0];
            karyawan.foto = karyawan.foto ? `data:image/jpeg;base64,${Buffer.from(karyawan.foto).toString('base64')}` : null;
            res.json({ success: true, data: karyawan });
        } catch (error) {
            console.error('Error mengambil detail karyawan:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan.' });
        } finally {
            if (connection) connection.release();
        }
    });

    return router;
};