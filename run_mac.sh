#!/bin/bash

# ANSI Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      🚀 LOCAL-LAN-MESSENGER - MACOS/LINUX SETUP 🚀   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}\n"

# Check for Python
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo -e "${RED}❌ Python is not installed!${NC}"
    echo "   Please install Python 3.7+ (brew install python)"
    exit 1
fi

echo -e "${YELLOW}📦 Checking dependencies...${NC}"

# Check if venv exists, if not create it
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🔨 Creating virtual environment...${NC}"
    $PYTHON_CMD -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

echo -e "\n${GREEN}✅ Setup Complete!${NC}\n"

# Get Local IP
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}')

echo -e "══════════════════════════════════════════════════════"
echo -e "  ✅ SERVER AVAILABLE AT:"
echo -e ""
echo -e "  💻 Local:    http://localhost:8000"
if [ ! -z "$IP" ]; then
    echo -e "  🌐 Network:  http://$IP:8000"
fi
echo -e "══════════════════════════════════════════════════════"
echo -e "\n  🛑 Press Ctrl+C to stop the server\n"

# Run Server
python main.py
