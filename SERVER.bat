@echo off
REM ============================================================
REM   PLAYLY. - Server Manager (PM2)
REM   Pakai: SERVER.bat            -> menu interaktif
REM          SERVER.bat start      -> langsung start
REM          SERVER.bat stop       -> langsung stop
REM          SERVER.bat status     -> langsung status
REM ============================================================
setlocal

REM Argumen langsung -> skip menu
if /i "%~1"=="start"  goto :do_start
if /i "%~1"=="stop"   goto :do_stop
if /i "%~1"=="status" goto :do_status

:menu
cls
title Playly Server Manager
color 0B
echo.
echo  =========================================
echo    PLAYLY. - Server Manager (PM2)
echo  =========================================
echo.
echo    [1] Start server
echo    [2] Stop server
echo    [3] Status server
echo    [0] Keluar
echo.
set /p "PICK=  Pilih opsi: "

if "%PICK%"=="1" goto :do_start
if "%PICK%"=="2" goto :do_stop
if "%PICK%"=="3" goto :do_status
if "%PICK%"=="0" exit /b 0
goto :menu

:do_start
title Playly Server - Start
color 0A
echo.
echo  =========================================
echo    PLAYLY. - Start Server (vercel dev)
echo  =========================================
echo.

REM Per fix user 2026-05-15 v79: pakai `node dev-server.js` (server yg
REM beneran jalan & terbukti bind ke port 1508). pm2/vercel/live-server
REM TIDAK ke-install di laptop ini → bikin server gagal start (ERR_CONNECTION_REFUSED).

cd /d "%~dp0"

REM Kill apapun yang listen di port 1508 (server lama / nyangkut)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :1508 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  [INFO] Memulai Playly dev server (node dev-server.js) di port 1508...
start "Playly Server" cmd /k "node dev-server.js"
timeout /t 3 >nul

echo.
echo  [OK] Server aktif di http://127.0.0.1:1508
echo.
echo  PENTING: jendela "Playly Server" yang baru kebuka JANGAN ditutup.
echo  Selama jendela itu terbuka, server hidup. Ditutup = server mati.
echo.
if "%~1"=="" pause
timeout /t 2 >nul
exit /b 0

:do_stop
title Playly Server - Stop
color 0C
echo.
echo  =========================================
echo    PLAYLY. - Stop Server (PM2)
echo  =========================================
echo.

pm2 stop playly 2>nul
pm2 delete playly 2>nul
pm2 save --force 2>nul

REM Backup: kill proses node yang masih listen di 1508
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :1508 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  [OK] Server dihentikan.
echo.
if "%~1"=="" pause
timeout /t 2 >nul
exit /b 0

:do_status
title Playly Server - Status
color 0B
echo.
echo  =========================================
echo    PLAYLY. - Server Status
echo  =========================================
echo.

pm2 status

echo.
echo  Port 1508 status:
netstat -ano | findstr :1508 | findstr LISTENING
if %errorlevel% NEQ 0 (
    echo  [!] Tidak ada proses listen di port 1508
) else (
    echo  [OK] Server aktif di http://127.0.0.1:1508
)

echo.
if "%~1"=="" pause
timeout /t 2 >nul
exit /b 0
