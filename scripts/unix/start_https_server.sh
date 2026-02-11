#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-8000}"

get_lan_ip() {
  local ip
  ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}') || true
  if [[ -z "${ip:-}" ]]; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}') || true
  fi
  if [[ -z "${ip:-}" ]]; then
    ip="127.0.0.1"
  fi
  printf '%s' "$ip"
}

LAN_IP="$(get_lan_ip)"

echo
echo "🔒 Local-LAN-Messenger HTTPS server"
echo "-----------------------------------"

if [[ ! -f cert.pem || ! -f key.pem ]]; then
  echo "🔑 SSL certificates not found. Generating for IP: ${LAN_IP}"
  python3 generate_ssl.py "$LAN_IP"
fi

echo "💻 Local URL:   https://localhost:${PORT}"
echo "🌐 Share URL:   https://${LAN_IP}:${PORT}"
echo "⚠️  First-time browser certificate warning is expected"
echo "🛑 Stop with:   Ctrl+C"
echo

python3 main.py --ssl --host 0.0.0.0 --port "$PORT"
