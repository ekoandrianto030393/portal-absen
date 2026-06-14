@echo off
cd /d "%~dp0"
color 0E
title PYTHON SERVER (ANTI-SPOOFING)

:loop
echo =======================================================
echo          MEMULAI SERVER PYTHON (INSIGHTFACE)
echo =======================================================
python python_server.py

echo.
echo =======================================================
echo [WARNING] SERVER PYTHON BERHENTI ATAU CRASH!
echo [SYSTEM] Memulai ulang otomatis dalam 3 detik...
echo =======================================================
timeout /t 3 > NUL
goto loop
