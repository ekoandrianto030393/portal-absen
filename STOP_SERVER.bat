@echo off
color 0C
title MEMATIKAN SERVER BIOMETRIK...

echo =======================================================
echo          MEMATIKAN SERVER BIOMETRIK TERSEMBUNYI
echo =======================================================
echo.
echo Menghentikan proses Node.js...
taskkill /F /IM node.exe /T 2>NUL

echo Menghentikan proses Python...
taskkill /F /IM python.exe /T 2>NUL

echo.
echo =======================================================
echo SEMUA SERVER TELAH BERHASIL DIMATIKAN!
echo =======================================================
echo.
pause
