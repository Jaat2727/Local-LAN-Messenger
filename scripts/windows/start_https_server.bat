@echo off
setlocal
chcp 65001 >nul
title Local-LAN-Messenger - HTTPS Secure Server
color 0A

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

set "PORT=8000"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║    🔒 LOCAL-LAN-MESSENGER - HTTPS SECURE SERVER 🔒    ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  HTTPS enables: Voice Calls, Video Calls, Camera    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

echo 📡 Finding your active network address...
for /f "delims=" %%i in ('powershell -NoProfile -Command "$cfg = Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1; if($cfg -and $cfg.IPv4Address){$cfg.IPv4Address.IPAddress}else{'127.0.0.1'}"') do set "IP=%%i"
if not defined IP set "IP=127.0.0.1"

if not exist "cert.pem" (
    echo.
    echo 🔑 SSL certificates not found!
    echo 📝 Generating secure certificates for IP: %IP%
    python generate_ssl.py %IP%
    if errorlevel 1 (
        echo.
        echo ❌ FAILED to generate certificates!
        echo 💡 FIX: pip install cryptography
        pause
        exit /b 1
    )
    echo ✅ Certificates generated successfully!
    echo.
)

echo.
echo ══════════════════════════════════════════════════════
echo   ✅ YOUR SECURE CHAT SERVER WILL BE AVAILABLE AT:
echo.
echo   💻 This Computer:   https://localhost:%PORT%
echo   🌐 Network/Others:  https://%IP%:%PORT%
echo ══════════════════════════════════════════════════════
echo.
echo   ⚠️  First-time warning is normal for self-signed cert
echo   🛑 Press Ctrl+C to stop the server
echo ══════════════════════════════════════════════════════
echo.

python main.py --ssl --host 0.0.0.0 --port %PORT%

echo.
echo ══════════════════════════════════════════════════════
echo   Secure server stopped. You can close this window now.
echo ══════════════════════════════════════════════════════
pause
