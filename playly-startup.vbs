' Playly Server Auto-Start (Hidden)
' Dijalankan otomatis saat Windows login via Startup folder.
' Memanggil SERVER.bat dengan argumen "start" supaya langsung start
' tanpa nunggu user pilih menu.
Option Explicit

Dim WshShell, dashboardPath
Set WshShell = CreateObject("WScript.Shell")

dashboardPath = "C:\Users\USER\playly-dashboard"

' Jalankan SERVER.bat start secara hidden (0 = no window)
WshShell.CurrentDirectory = dashboardPath
WshShell.Run "cmd /c """ & dashboardPath & "\SERVER.bat"" start", 0, False
