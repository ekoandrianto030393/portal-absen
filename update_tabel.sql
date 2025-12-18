-- Perintah SQL untuk memperbarui struktur tabel yang ada

-- 1. Menambahkan kolom 'jabatan' dan 'foto' ke tabel 'karyawan'
-- 'jabatan' akan menyimpan posisi/role karyawan (misal: "Dokter", "Perawat").
-- 'foto' akan menyimpan data gambar wajah dalam format BLOB (Binary Large Object).
ALTER TABLE karyawan
ADD COLUMN jabatan VARCHAR(50) AFTER nama,
ADD COLUMN foto LONGBLOB AFTER face_descriptor;

-- 2. Menambahkan kolom 'keterangan' ke tabel 'absensi'
-- Kolom ini digunakan di server.js untuk menyimpan catatan, 
-- seperti "Absen Masuk Normal" atau "Otomatis: Lupa Absen Pulang".
-- Menambahkannya akan mencegah potensi error saat server berjalan.
ALTER TABLE absensi
ADD COLUMN keterangan VARCHAR(255);
