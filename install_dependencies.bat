@echo off
title Installing Dependencies...
color 0A

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║        🚀 INSTALLING REQUIREMENTS...                ║
echo ╚══════════════════════════════════════════════════════╝
echo.

python -m pip install --upgrade pip
if errorlevel 1 (
    echo.
    echo ❌ Python is not installed or not in PATH.
    echo    Please install Python from python.org and try again.
    pause
    exit /b
)

echo.
echo 📦 Installing libraries...
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ❌ Failed to install dependencies.
    echo    Check your internet connection.
    pause
    exit /b
)

echo.
echo ✅ All dependencies installed successfully!
echo.
echo    You can now run:
echo    - start_server.bat        (for Local HTTP)
echo    - start_https_server.bat  (for Secure HTTPS)
echo.
pause
