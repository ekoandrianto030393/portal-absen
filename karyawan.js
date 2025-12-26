const express = require('express');
const router = express.Router();

module.exports = (pool) => {

    // =====================================================
    // GET: Mengambil semua descriptor wajah (UNTUK SCAN)
    // Endpoint di server.js: /api/karyawan/descriptors
    // =====================================================
    router.get('/descriptors', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute(
                'SELECT id_karyawan, nama, jabatan, face_descriptor, foto FROM karyawan'
            );

            rows.forEach(row => {
                // Ensure face_descriptor is parsed into an array/object if it's a string
                if (row.face_descriptor && typeof row.face_descriptor === 'string') {
                    try {
                        row.face_descriptor = JSON.parse(row.face_descriptor);
                    } catch (e) {
                        console.error('Error parsing face_descriptor:', e);
                    }
                }
                if (row.foto) {
                    row.foto = `data:image/jpeg;base64,${Buffer.from(row.foto).toString('base64')}`;
                }
            });

            res.json({ success: true, descriptors: rows });

        } catch (error) {
            console.error('Error mengambil descriptor:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil data descriptor.'
            });
        } finally {
            if (connection) connection.release();
        }
    });

    // =====================================================
    // POST: Register / Update Wajah (ADMIN)
    // Endpoint di server.js: /api/karyawan/register_face
    // =====================================================
    router.post('/register_face', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();

            const { id_karyawan, nama, jabatan, descriptor, foto } = req.body;

            if (!id_karyawan || !nama || !descriptor) {
                return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
            }

            const finalJabatan = jabatan && jabatan.trim() !== '' ? jabatan : 'Staff';
            const karyawanId = id_karyawan.toUpperCase();
            const descriptorJson = JSON.stringify(descriptor);

            let fotoBuffer = null;
            if (foto) {
                const base64Data = foto.replace(/^data:image\/[a-z]+;base64,/, '');
                fotoBuffer = Buffer.from(base64Data, 'base64');
            }

            const [rows] = await connection.execute(
                'SELECT COUNT(*) AS count FROM karyawan WHERE id_karyawan = ?',
                [karyawanId]
            );

            let message;
            if (rows[0].count > 0) {
                const sql = fotoBuffer
                    ? 'UPDATE karyawan SET nama = ?, jabatan = ?, face_descriptor = ?, foto = ? WHERE id_karyawan = ?'
                    : 'UPDATE karyawan SET nama = ?, jabatan = ?, face_descriptor = ? WHERE id_karyawan = ?';
                const params = fotoBuffer
                    ? [nama, finalJabatan, descriptorJson, fotoBuffer, karyawanId]
                    : [nama, finalJabatan, descriptorJson, karyawanId];
                await connection.execute(sql, params);
                message = `Update berhasil: **${nama}**`;
            } else {
                await connection.execute(
                    'INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto) VALUES (?, ?, ?, ?, ?)',
                    [karyawanId, nama, finalJabatan, descriptorJson, fotoBuffer]
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

    // =====================================================
    // GET: Detail satu karyawan
    // =====================================================
    router.get('/:id', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT id_karyawan, nama, jabatan FROM karyawan WHERE id_karyawan = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
            res.json({ success: true, data: rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan.' });
        }
    });

    return router;
};