@echo off
cd /d "%~dp0"
color 0B
title NODE.JS GUARDIAN SERVER (BIOMETRIK)

echo =======================================================
echo     SISTEM ABSENSI BIOMETRIK - NODE.JS ONLY
echo =======================================================
echo.
echo Menjalankan penjaga (guardian) Server Node.js...
echo Server akan otomatis hidup kembali jika terjadi crash.
echo.
echo Tekan [CTRL+C] jika ingin mematikan server secara total.
echo =======================================================
echo.

:: === [NEW] START TTS FALLBACK SERVER ===
echo Memulai Python TTS Fallback Server (Port 5002)...
start "TTS Fallback Server" cmd /c "venv\Scripts\activate.bat && python tts_server.py"
:: Tunggu sebentar agar TTS siap
timeout /t 2 > NUL

:loop
echo [%date% %time%] Memulai Server Node.js...
:: Menggunakan node server.js langsung lebih kebal terhadap "Terminate batch job" prompt dibanding npm start
node server.js

echo.
echo =======================================================
echo [WARNING] SERVER NODE.JS BERHENTI ATAU MENGALAMI CRASH!
echo [SYSTEM] Memulai ulang otomatis dalam 3 detik...
echo =======================================================
timeout /t 3 > NUL
goto loop
