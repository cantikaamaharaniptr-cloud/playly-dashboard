@echo off
REM ============================================================
REM   PLAYLY. - Buka Dashboard
REM   Pilih browser: Chrome / Edge / Default
REM ============================================================
setlocal

:menu
cls
title Playly Dashboard Launcher
color 0B
echo.
echo  =========================================
echo    PLAYLY. - Video Dashboard Launcher
echo  =========================================
echo.
echo    [1] Buka di Google Chrome
echo    [2] Buka di Microsoft Edge
echo    [3] Buka di browser default
echo    [0] Keluar
echo.
set /p "PICK=  Pilih opsi: "

if "%PICK%"=="1" goto :open_chrome
if "%PICK%"=="2" goto :open_edge
if "%PICK%"=="3" goto :open_default
if "%PICK%"=="0" exit /b 0
goto :menu

REM ==== Pastikan server jalan ====
:ensure_server
netstat -ano | findstr :8080 | findstr LISTENING >nul
if %errorlevel% NEQ 0 (
    echo  [INFO] Server belum jalan. Memulai live-server...
    cd /d "%~dp0"
    start "Playly Server" cmd /k "live-server --port=8080 --host=127.0.0.1 --no-browser"
    timeout /t 3 >nul
) else (
    echo  [OK] Server sudah berjalan di port 8080
)
exit /b 0

:open_chrome
call :ensure_server
echo.
echo  Membuka dashboard di Chrome...
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
    start "" "%CHROME%" "http://localhost:8080"
    echo  [OK] Chrome dibuka.
) else (
    echo  [WARN] Chrome tidak ditemukan, membuka browser default...
    start "" "http://localhost:8080"
)
timeout /t 2 >nul
exit /b 0

:open_edge
call :ensure_server
echo.
echo  Membuka dashboard di Edge...
set "EDGE="
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE (
    start "" "%EDGE%" "http://localhost:8080"
    echo  [OK] Edge dibuka.
) else (
    echo  [WARN] Edge tidak ditemukan, membuka browser default...
    start "" microsoft-edge:http://localhost:8080
)
timeout /t 2 >nul
exit /b 0

:open_default
call :ensure_server
echo.
echo  Membuka dashboard di browser default...
start "" "http://localhost:8080"
timeout /t 2 >nul
exit /b 0
