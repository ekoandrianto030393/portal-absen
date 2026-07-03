<?php
// check_karyawan.php - Script untuk mengecek isi database tanpa phpMyAdmin
header("Content-Type: text/html");

// Fungsi untuk meload file .env
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $_ENV[trim($name)] = trim($value);
        }
    }
}
loadEnv(__DIR__ . '/.env');

// Konfigurasi dari .env
$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$db   = $_ENV['DB_NAME'] ?? 'biometrik_absensi_wajah_db';
$user = $_ENV['DB_USER'] ?? 'root';
$pass = $_ENV['DB_PASS'] ?? '';

echo "<h1>Cek Data Database</h1>";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Cek jumlah data
    $stmt = $pdo->query("SELECT * FROM karyawan ORDER BY created_at DESC");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h3>Status: Terkoneksi ke Database '$db'</h3>";
    echo "<p>Jumlah Karyawan Terdaftar: <strong>" . count($rows) . "</strong></p>";

    if (count($rows) > 0) {
        echo "<table border='1' cellpadding='10' style='border-collapse: collapse; width: 100%;'>";
        echo "<tr style='background: #eee;'><th>ID</th><th>Nama</th><th>Jabatan</th><th>Ukuran Foto</th><th>Ukuran Descriptor</th><th>Waktu Daftar</th></tr>";
        foreach($rows as $row) {
            $fotoSize = strlen($row['foto']) . " bytes";
            $descSize = strlen($row['face_descriptor']) . " chars";
            $waktu = isset($row['created_at']) ? $row['created_at'] : '-';
            echo "<tr>";
            echo "<td>{$row['id_karyawan']}</td>";
            echo "<td>{$row['nama']}</td>";
            echo "<td>{$row['jabatan']}</td>";
            echo "<td>{$fotoSize}</td>";
            echo "<td>{$descSize}</td>";
            echo "<td>{$waktu}</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p style='color:red;'>Tabel karyawan kosong.</p>";
    }
} catch (PDOException $e) {
    echo "<h3 style='color:red;'>Koneksi Gagal: " . $e->getMessage() . "</h3>";
    echo "<p>Pastikan MySQL di XAMPP sudah di-Start.</p>";
}
?>