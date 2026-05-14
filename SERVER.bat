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

REM Update 2026-05-11: switch dari live-server ke vercel dev biar localhost
REM serve 100% sama dengan production di Vercel — termasuk:
REM   - URL rewrites dari vercel.json (/admin, /watch, /id/:videoId, dst)
REM   - Edge Functions di /api/* (translate-subtitle pakai DeepL)
REM Reuse PM2 manager supaya autostart-on-login (via VBS) tetap kerja.

cd /d "%~dp0"

REM Kill anything currently listening on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

pm2 describe playly >nul 2>&1
if %errorlevel%==0 (
    echo  [INFO] Server lama detected, hapus dulu...
    pm2 delete playly >nul 2>&1
)

echo  [INFO] Memulai vercel dev di port 8080 via pm2...
REM Note: PM2 di Windows nggak bisa spawn .cmd wrapper langsung — pakai path JS asli (vc.js)
pm2 start "C:\Users\USER\AppData\Roaming\npm\node_modules\vercel\dist\vc.js" --name playly --cwd "%~dp0" -- dev --listen 8080 --yes --scope cantikaamaharaniptr-clouds-projects
pm2 save --force

echo.
echo  [OK] Server aktif di http://localhost:8080
echo  [INFO] Sama persis dengan https://playly-dashboard.vercel.app
echo.
echo  Server akan tetap berjalan walau jendela ini ditutup.
echo  Jalankan SERVER.bat stop untuk menghentikan server.
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

REM Backup: kill proses node yang masih listen di 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
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
echo  Port 8080 status:
netstat -ano | findstr :8080 | findstr LISTENING
if %errorlevel% NEQ 0 (
    echo  [!] Tidak ada proses listen di port 8080
) else (
    echo  [OK] Server aktif di http://localhost:8080
)

echo.
if "%~1"=="" pause
timeout /t 2 >nul
exit /b 0
