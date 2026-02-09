@echo off
chcp 65001 >nul
title Local-LAN-Messenger - HTTPS Secure Server
color 0A

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║    🔒 LOCAL-LAN-MESSENGER - HTTPS SECURE SERVER 🔒    ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  HTTPS enables: Voice Calls, Video Calls, Camera    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Get the local IP address using PowerShell
echo 📡 Finding your network address...
for /f "delims=" %%i in ('powershell -NoProfile -Command "((Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4Address.IPAddress)"') do set IP=%%i

:: Check if certificates exist
if not exist "cert.pem" (
    echo.
    echo 🔑 SSL certificates not found!
    echo 📝 Generating secure certificates for IP: %IP%
    echo    ℹ️  This only happens once...
    echo.
    python generate_ssl.py %IP%
    if errorlevel 1 (
        echo.
        echo ❌ FAILED to generate certificates!
        echo.
        echo 💡 FIX: Install the cryptography package:
        echo    pip install cryptography
        echo.
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
echo   💻 This Computer:   https://localhost:8000
echo   🌐 Network/Others:  https://%IP%:8000
echo ══════════════════════════════════════════════════════
echo.
echo   📱 SHARE THE NETWORK LINK WITH FRIENDS TO CHAT!
echo   ⚠️  Everyone must be on the same WiFi network
echo.
echo   ⚠️  IMPORTANT - FIRST TIME BROWSER WARNING:
echo   ────────────────────────────────────────────────────
echo   Your browser will show a security warning because
echo   this is a self-signed certificate (not dangerous).
echo.
echo   🔹 Chrome: Click "Advanced" then "Proceed to site"
echo   🔹 Firefox: Click "Advanced" then "Accept the Risk"
echo   🔹 Edge: Click "Continue to site"
echo   🔹 Or type: thisisunsafe (on the warning page)
echo   ────────────────────────────────────────────────────
echo.
echo   🛑 Press Ctrl+C to stop the server
echo ══════════════════════════════════════════════════════
echo.
echo 📊 WHAT YOU'LL SEE BELOW:
echo    - 👋 When someone joins or leaves
echo    - 💬 When messages are sent
echo    - 📤 When files are uploaded  
echo    - 📞 When calls start/end
echo    - 🔗 WebRTC connection events
echo.
echo ────────────────────────────────────────────────────────
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem

echo.
echo ══════════════════════════════════════════════════════
echo   Server stopped. You can close this window now.
echo ══════════════════════════════════════════════════════
pause
