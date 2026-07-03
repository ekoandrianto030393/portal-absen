@echo off
title Instalasi Otomatis Aplikasi Biometrik Absensi
color 0A

echo ===================================================
echo     INSTALASI OTOMATIS APLIKASI ABSENSI WAJAH
echo ===================================================
echo.
echo Pastikan komputer ini sudah memenuhi syarat berikut:
echo 1. Node.js sudah terinstal.
echo 2. Python sudah terinstal (centang "Add to PATH" saat instalasi).
echo 3. XAMPP sudah terinstal dan [Apache] serta [MySQL] sudah di-START.
echo 4. Komputer terhubung ke internet.
echo.
echo Tekan tombol apa saja di keyboard jika syarat di atas sudah terpenuhi...
pause >nul

echo.
echo ===================================================
echo [1/4] Menginstal modul Node.js (harap tunggu)...
echo ===================================================
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gagal menginstal modul Node.js! 
    echo Pastikan Node.js terinstal dan komputer memiliki koneksi internet.
    pause
    exit /b
)
echo [OK] Modul Node.js berhasil diinstal.

echo.
echo ===================================================
echo [2/4] Membuat Virtual Environment Python (.venv)...
echo ===================================================
python -m venv .venv
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gagal membuat virtual environment Python! 
    echo Pastikan Python terinstal dan opsi "Add to PATH" sudah tercentang.
    pause
    exit /b
)
echo [OK] Virtual Environment (.venv) berhasil dibuat.

echo.
echo ===================================================
echo [3/4] Menginstal modul Python (butuh waktu agak lama)...
echo ===================================================
call .venv\Scripts\activate.bat
pip install -r requirements.txt
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gagal menginstal modul Python! 
    echo Pastikan koneksi internet stabil.
    pause
    exit /b
)
echo [OK] Modul Python berhasil diinstal.

echo.
echo ===================================================
echo [4/4] Menyiapkan Database MySQL secara otomatis...
echo ===================================================
echo Sedang membuat database dan tabel...
call node setup_db.js
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gagal menyiapkan database! 
    echo Pastikan MySQL di aplikasi XAMPP sudah menyala.
    pause
    exit /b
)
echo [OK] Database berhasil disiapkan.

echo.
color 0B
echo ===================================================
echo      INSTALASI SELESAI DENGAN SUKSES!
echo ===================================================
echo Aplikasi siap digunakan.
echo Silakan klik ganda file "start_server.bat" untuk menjalankan aplikasi sehari-hari.
echo.
pause
