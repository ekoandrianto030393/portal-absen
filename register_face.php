<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

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

// Konfigurasi Database dari .env
$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$db   = $_ENV['DB_NAME'] ?? 'biometrik_absensi_wajah_db';
$user = $_ENV['DB_USER'] ?? 'root';
$pass = $_ENV['DB_PASS'] ?? ''; 
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Ambil data JSON dari request
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON input']);
    exit;
}

// Ambil variabel dari input
$id_karyawan = $input['id_karyawan'] ?? '';
$nama = $input['nama'] ?? '';
$jabatan = $input['jabatan'] ?? 'Staff';
$descriptor = $input['descriptor'] ?? [];
$foto_base64 = $input['foto'] ?? '';

// Validasi kelengkapan data
if (empty($id_karyawan) || empty($nama) || empty($descriptor) || empty($foto_base64)) {
    echo json_encode(['success' => false, 'message' => 'Data tidak lengkap. ID, Nama, Descriptor, dan Foto wajib diisi.']);
    exit;
}

// Proses Foto: Hapus header data URI dan decode base64 menjadi binary
if (preg_match('/^data:image\/(\w+);base64,/', $foto_base64, $type)) {
    $foto_base64 = substr($foto_base64, strpos($foto_base64, ',') + 1);
    $foto_binary = base64_decode($foto_base64);
} else {
    echo json_encode(['success' => false, 'message' => 'Format foto tidak valid']);
    exit;
}

// Simpan descriptor sebagai JSON String di kolom LONGTEXT
// (Sesuai schema: tipe data LONGTEXT, isi berupa string representasi array)
$descriptor_json = json_encode($descriptor);

try {
    // Gunakan ON DUPLICATE KEY UPDATE agar jika ID sudah ada, data akan di-update
    $sql = "INSERT INTO karyawan (id_karyawan, nama, jabatan, foto, face_descriptor) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE nama = VALUES(nama), jabatan = VALUES(jabatan), foto = VALUES(foto), face_descriptor = VALUES(face_descriptor)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id_karyawan, $nama, $jabatan, $foto_binary, $descriptor_json]);

    // Debugging: Buat file log untuk bukti bahwa data berhasil diproses server
    file_put_contents('debug_register.txt', date('Y-m-d H:i:s') . " - SUKSES Simpan ID: $id_karyawan - Nama: $nama\n", FILE_APPEND);

    echo json_encode(['success' => true, 'message' => 'Data wajah berhasil disimpan untuk ID: ' . $id_karyawan]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database Error: ' . $e->getMessage()]);
}
?>