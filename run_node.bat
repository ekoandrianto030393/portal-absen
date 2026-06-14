@echo off
cd /d "%~dp0"
color 0B
title NODE.JS SERVER (BIOMETRIK)

:loop
echo =======================================================
echo          MEMULAI SERVER NODE.JS (FRONTEND ^& DB)
echo =======================================================
call npm start

echo.
echo =======================================================
echo [WARNING] SERVER NODE.JS BERHENTI ATAU CRASH!
echo [SYSTEM] Memulai ulang otomatis dalam 3 detik...
echo =======================================================
timeout /t 3 > NUL
goto loop
