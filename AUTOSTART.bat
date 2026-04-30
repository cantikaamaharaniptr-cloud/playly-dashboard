@echo off
REM ============================================================
REM   PLAYLY. - Autostart Manager
REM   Aktifkan/nonaktifkan server otomatis hidup saat Windows login.
REM ============================================================
setlocal
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_SRC=%~dp0playly-startup.vbs"
set "VBS_DST=%STARTUP%\playly-startup.vbs"

:menu
cls
title Playly Autostart Manager
color 0B
echo.
echo  =========================================
echo    PLAYLY. - Autostart saat Windows Login
echo  =========================================
echo.

if exist "%VBS_DST%" (
    echo    Status saat ini: [AKTIF]
) else (
    echo    Status saat ini: [NONAKTIF]
)
echo.
echo    [1] Aktifkan autostart
echo    [2] Nonaktifkan autostart
echo    [3] Refresh ^(salin ulang VBS terbaru^)
echo    [0] Keluar
echo.
set /p "PICK=  Pilih opsi: "

if "%PICK%"=="1" goto :enable
if "%PICK%"=="2" goto :disable
if "%PICK%"=="3" goto :enable
if "%PICK%"=="0" exit /b 0
goto :menu

:enable
color 0A
echo.
echo  Mengaktifkan autostart...
copy /Y "%VBS_SRC%" "%VBS_DST%" >nul
if %errorlevel%==0 (
    echo  [OK] Autostart aktif. Server akan otomatis hidup setiap Windows login.
) else (
    echo  [ERROR] Gagal copy ke Startup folder.
    echo         Cek apakah file %VBS_SRC% ada.
)
echo.
pause
goto :menu

:disable
color 0E
echo.
echo  Menonaktifkan autostart...
if exist "%VBS_DST%" (
    del "%VBS_DST%"
    echo  [OK] Autostart dinonaktifkan.
    echo  Server tidak akan otomatis hidup saat Windows login.
) else (
    echo  [INFO] Autostart memang belum aktif.
)
echo.
pause
goto :menu
