@echo off
setlocal
chcp 65001 >nul
title Local-LAN-Messenger - HTTP Server
color 0A

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

set "PORT=8000"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║       🚀 LOCAL-LAN-MESSENGER - HTTP SERVER 🚀       ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  Starting your chat server...                       ║
echo ╚══════════════════════════════════════════════════════╝
echo.

echo 📡 Finding your active network address...
for /f "delims=" %%i in ('powershell -NoProfile -Command "$cfg = Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1; if($cfg -and $cfg.IPv4Address){$cfg.IPv4Address.IPAddress}else{'127.0.0.1'}"') do set "IP=%%i"
if not defined IP set "IP=127.0.0.1"

echo.
echo ══════════════════════════════════════════════════════
echo   ✅ YOUR CHAT SERVER WILL BE AVAILABLE AT:
echo.
echo   💻 This Computer:   http://localhost:%PORT%
echo   🌐 Network/Others:  http://%IP%:%PORT%
echo ══════════════════════════════════════════════════════
echo.
echo   📱 SHARE THE NETWORK LINK WITH FRIENDS TO CHAT!
echo   ⚠️  Everyone must be on the same WiFi/LAN network
echo.
echo   🛑 Press Ctrl+C to stop the server
echo ══════════════════════════════════════════════════════
echo.

uvicorn main:app --host 0.0.0.0 --port %PORT%

echo.
echo ══════════════════════════════════════════════════════
echo   Server stopped. You can close this window now.
echo ══════════════════════════════════════════════════════
pause
