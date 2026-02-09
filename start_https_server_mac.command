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
echo -e "${GREEN}║   🔒 LOCAL-LAN-MESSENGER - MAC STARTUP (HTTPS) 🔒    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}\n"

# Check for Python
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo -e "${RED}❌ Python is not installed!${NC}"
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

# Get Local IP
IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
    IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ]; then
    IP=$(hostname -I | awk '{print $1}')
fi

# Generate SSL if missing
if [ ! -f "cert.pem" ]; then
    echo -e "${YELLOW}🔐 Generating SSL Certificates...${NC}"
    python generate_ssl.py $IP
fi

echo -e "\n${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  ✅ SECURE SERVER READY! SHARE THIS LINK:"
echo -e ""
echo -e "  💻 THIS COMPUTER:   https://localhost:8000"
echo -e "  🌐 SHARE WITH FRIENDS:  ${GREEN}https://$IP:8000${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  ⚠️  Accept the 'Unsafe' warning in browser"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"

# Run Server
uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem

# Keep window open
echo -e "\n${RED}Server stopped.${NC}"
read -p "Press Enter to exit..."
