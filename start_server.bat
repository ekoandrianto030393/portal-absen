@echo off
cd /d "%~dp0"
color 0A
title BIOMETRIK STARTUP MANAGER

echo =======================================================
echo          SISTEM ABSENSI BIOMETRIK (DUAL SERVER)
echo =======================================================
echo.
echo [1] Menyalakan Server Node.js (Frontend ^& DB Route)...
start "NODE.JS SERVER (BIOMETRIK)" cmd /k "%~dp0run_node.bat"

timeout /t 2 /nobreak > NUL

echo.
echo [2] Menyalakan Server Python (InsightFace ^& Anti-Spoof)...
start "PYTHON SERVER (ANTI-SPOOFING)" cmd /k "%~dp0run_python.bat"

echo.
echo =======================================================
echo SELESAI! DUA JENDELA TERMINAL TELAH TERBUKA!
echo.
echo PENTING: JANGAN TUTUP KEDUA JENDELA HITAM TERSEBUT.
echo Jika ditutup, server akan mati. Silakan di-minimize saja.
echo =======================================================
echo.
pause