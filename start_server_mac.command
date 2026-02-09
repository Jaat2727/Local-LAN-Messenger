#!/bin/bash

# Get the directory where the script is located
cd "$(dirname "$0")"

# ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     🚀 LOCAL-LAN-MESSENGER - MAC STARTUP (HTTP) 🚀   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}\n"

# Check for Python
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo -e "${RED}❌ Python is not installed!${NC}"
    echo "   Please install Python 3.7+ (brew install python)"
    read -p "Press Enter to exit..."
    exit 1
fi

# Setup Venv
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🔨 Creating virtual environment...${NC}"
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Get Local IP (Try en0 first for WiFi, then en1, then hostname)
IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
    IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ]; then
    IP=$(hostname -I | awk '{print $1}')
fi

echo -e "\n${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  ✅ SERVER READY! SHARE THIS LINK:"
echo -e ""
echo -e "  💻 THIS COMPUTER:   http://localhost:8000"
echo -e "  🌐 SHARE WITH FRIENDS:  ${GREEN}http://$IP:8000${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "\n  🛑 Press Ctrl+C to stop the server\n"

# Run Server
python main.py

# Keep window open if server crashes
echo -e "\n${RED}Server stopped.${NC}"
read -p "Press Enter to exit..."
