@echo off
chcp 65001 >nul
title Local-LAN-Messenger - HTTP Server
color 0A

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║       🚀 LOCAL-LAN-MESSENGER - HTTP SERVER 🚀       ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  Starting your chat server...                       ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Get the local IP address using PowerShell (most reliable method)
echo 📡 Finding your network address...
for /f "delims=" %%i in ('powershell -NoProfile -Command "((Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4Address.IPAddress)"') do set IP=%%i

echo.
echo ══════════════════════════════════════════════════════
echo   ✅ YOUR CHAT SERVER WILL BE AVAILABLE AT:
echo.
echo   💻 This Computer:   http://localhost:8000
echo   🌐 Network/Others:  http://%IP%:8000
echo ══════════════════════════════════════════════════════
echo.
echo   📱 SHARE THE NETWORK LINK WITH FRIENDS TO CHAT!
echo   ⚠️  Everyone must be on the same WiFi network
echo.
echo   🛑 Press Ctrl+C to stop the server
echo ══════════════════════════════════════════════════════
echo.
echo 📊 WHAT YOU'LL SEE BELOW:
echo    - 👋 When someone joins or leaves
echo    - 💬 When messages are sent
echo    - 📤 When files are uploaded
echo    - 📞 When calls are made
echo.
echo ────────────────────────────────────────────────────────
echo.

:: Start uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000

echo.
echo ══════════════════════════════════════════════════════
echo   Server stopped. You can close this window now.
echo ══════════════════════════════════════════════════════
pause
