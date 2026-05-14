@echo off
title Playly Dashboard - Deploy ke Vercel
color 0E
cd /d "%~dp0"

echo.
echo  =========================================
echo    PLAYLY. - Deploy ke Vercel (Production)
echo  =========================================
echo.

REM ==== Cek Vercel CLI ====
where vercel >nul 2>&1
if errorlevel 1 (
    echo  [WARN] Vercel CLI belum terinstall.
    echo.
    echo  Jalankan perintah ini di PowerShell ^(as Administrator kalau perlu^):
    echo.
    echo      npm install -g vercel
    echo.
    echo  Setelah selesai, double-click DEPLOY.bat lagi.
    echo.
    pause
    exit /b 1
)

REM ==== Cek login ====
echo  [INFO] Cek status login Vercel...
call vercel whoami >nul 2>&1
if errorlevel 1 (
    echo  [INFO] Belum login. Jalankan login...
    echo.
    call vercel login
    if errorlevel 1 (
        echo.
        echo  [ERROR] Login gagal. Coba: vercel login
        pause
        exit /b 1
    )
)

echo.
echo  [OK] Vercel CLI siap. Mulai deploy...
echo.
echo  =========================================
echo    Deploy ke production
echo  =========================================
echo.

call vercel --prod

if errorlevel 1 (
    echo.
    echo  [ERROR] Deploy gagal. Cek pesan error di atas.
    pause
    exit /b 1
)

echo.
echo  =========================================
echo    [OK] Deploy selesai!
echo  =========================================
echo.
echo  Buka: https://playly-dashboard.vercel.app
echo  Tips: Hard-refresh browser (Ctrl+Shift+R) untuk bypass cache.
echo.
pause