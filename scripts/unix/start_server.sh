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
echo "🚀 Local-LAN-Messenger HTTP server"
echo "-----------------------------------"
echo "💻 Local URL:   http://localhost:${PORT}"
echo "🌐 Share URL:   http://${LAN_IP}:${PORT}"
echo "🛑 Stop with:   Ctrl+C"
echo

uvicorn main:app --host 0.0.0.0 --port "$PORT"
