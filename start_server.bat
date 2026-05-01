@echo off
:: ==================================================
:: LAUNCHER OTOMATIS - BIOMETRIK ABSENSI
:: ==================================================
title Server Biometrik Absensi
cd /d "%~dp0"

cls
echo.
echo [SYSTEM] Sedang mempersiapkan server...
echo [SYSTEM] Mohon tunggu sebentar...
echo.

echo ============================================================
echo [INFO] UNTUK AKSES DARI KOMPUTER/HP LAIN (SATU WIFI):
echo Gunakan IP Address di bawah ini, contoh: http://192.168.1.5:3000/scan.html
ipconfig | findstr /i "IPv4 IP Address Alamat"
echo ============================================================
echo.

:: 1. Buka Browser Otomatis (Delay 3 detik agar server siap)
timeout /t 3 /nobreak >nul
echo [SYSTEM] Membuka Dashboard Absensi...
start http://localhost:3000/scan.html

:: 2. Jalankan Server Python untuk Verifikasi Wajah
echo [SYSTEM] Menjalankan Service Python (Face Verification)...
start cmd /k "python python_server.py"

:: 3. Jalankan Server Node.js
echo [SYSTEM] Menjalankan Service Node.js...
echo [INFO]   Tekan CTRL+C untuk mematikan server.
echo.
node server.js

pause