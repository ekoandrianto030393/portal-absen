-- ======================================================
-- 0. BUAT DATABASE BARU (Khusus Install Ulang)
-- ======================================================
CREATE DATABASE IF NOT EXISTS biometrik_absensi_wajah_db;
USE biometrik_absensi_wajah_db;

-- 1. Hapus View lama yang rusak (Penyebab Error #1356)
-- 1. Bersihkan View lama
DROP VIEW IF EXISTS absensi_harian_hitung;
DROP VIEW IF EXISTS rekap_gaji_bulanan;
DROP VIEW IF EXISTS view_rekap_bulanan;
DROP VIEW IF EXISTS rekap_bulanan;

-- 2. Bersihkan Tabel lama
-- Hapus tabel lama jika ada untuk menghindari konflik.
-- PERHATIAN: Ini akan menghapus semua data yang ada di tabel ini.
DROP TABLE IF EXISTS absensi;
DROP TABLE IF EXISTS karyawan;

-- ======================================================
-- TABEL 1: KARYAWAN (Struktur yang Benar)
-- Menyimpan data profil, foto, dan biometrik wajah karyawan.
-- ======================================================
CREATE TABLE karyawan (
    id_karyawan VARCHAR(50) NOT NULL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    jabatan VARCHAR(50),
    face_descriptor LONGTEXT NOT NULL,
    foto LONGBLOB,
    tanggal_registrasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- TABEL 2: ABSENSI (Struktur yang Benar)
-- Menyimpan rekap absensi harian (satu baris per karyawan per hari).
-- ======================================================
CREATE TABLE absensi (
    id_absensi INT AUTO_INCREMENT PRIMARY KEY,
    id_karyawan VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL,
    jam_masuk TIME NULL,
    jam_keluar TIME NULL,
    status VARCHAR(50),
    UNIQUE KEY unique_absensi_harian (id_karyawan, tanggal),
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan) ON DELETE CASCADE
);

-- ======================================================
-- VIEW: REKAP BULANAN
-- Menghitung statistik bulanan (Telat, Pulang, Jam Kerja, dll)
-- ======================================================
CREATE OR REPLACE VIEW view_rekap_bulanan AS
SELECT 
    k.id_karyawan,
    k.nama,
    k.jabatan,
    m.periode,
    COUNT(a.jam_masuk) AS total_masuk,
    GREATEST(0, m.total_hari_kerja - COUNT(a.jam_masuk)) AS alpa,
    SUM(CASE WHEN a.jam_masuk > '08:20:00' THEN 1 ELSE 0 END) AS telat_kali,
    COALESCE(SUM(CASE WHEN a.jam_masuk > '08:20:00' THEN FLOOR((TIME_TO_SEC(a.jam_masuk) - TIME_TO_SEC('08:00:00')) / 60) ELSE 0 END), 0) AS telat_menit,
    SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN 1 ELSE 0 END) AS tanpa_absen_pulang,
    SUM(CASE WHEN a.jam_keluar IS NOT NULL THEN 1 ELSE 0 END) AS pulang_kali,
    SUM(CASE WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN 2 ELSE 0 END) AS potongan_jam, -- Nilai default 2, akan diupdate otomatis oleh server.js dari .env
    SEC_TO_TIME(SUM(
        CASE 
            WHEN a.jam_keluar IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.jam_masuk, a.jam_keluar)
            WHEN a.jam_masuk IS NOT NULL AND a.jam_keluar IS NULL AND a.tanggal < CURDATE() THEN GREATEST(0, TIMESTAMPDIFF(SECOND, a.jam_masuk, '14:00:00'))
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


-- ======================================================
-- VIEW: ABSENSI HARIAN (SOLUSI PERTANYAAN ANDA)
-- Gunakan view ini untuk melihat data absensi LENGKAP dengan NAMA.
-- ======================================================
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