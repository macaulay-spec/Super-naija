#!/usr/bin/env bash
# Start IBADAN LIFE (client + multiplayer) and publish it via a Cloudflare quick tunnel.
# Usage:  bash scripts/start-public.sh
set -e
cd "$(dirname "$0")/.."

PORT="${PORT:-8090}"

echo "[1/3] Building client…"
npm run build

echo "[2/3] Starting game + multiplayer server on :$PORT …"
PORT="$PORT" node server/index.js > /tmp/ibadan-server.log 2>&1 &
echo "      server pid $!  (logs: /tmp/ibadan-server.log)"
sleep 2

echo "[3/3] Opening public tunnel…"
if ! command -v cloudflared >/dev/null 2>&1 && [ ! -x /tmp/cloudflared ]; then
  echo "      downloading cloudflared…"
  curl -sL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /tmp/cloudflared
fi
CF="$(command -v cloudflared || echo /tmp/cloudflared)"
"$CF" tunnel --url "http://localhost:$PORT" --no-autoupdate 2>&1 | tee /tmp/ibadan-tunnel.log &
sleep 12
URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/ibadan-tunnel.log | head -1)"
echo
echo "======================================================"
echo " IBADAN LIFE is live at:  $URL"
echo " (ephemeral tunnel — stays up while this script runs)"
echo "======================================================"
