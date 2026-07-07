#!/usr/bin/env bash
set -e

# Nova Voice Bridge — starts the API server + cloudflared tunnel

ROOT_DIR="$HOME/voice-nova"
API_PORT=8899
LOG_DIR="$HOME/.hermes/logs"

mkdir -p "$LOG_DIR"

# Start the API server
python3 -u "$ROOT_DIR/../voice-nova-server.py" "$API_PORT" > "$LOG_DIR/nova-voice-api.log" 2>&1 &
API_PID=$!
echo "API server started (PID: $API_PID, port: $API_PORT)"

# Wait for it to be ready
sleep 2

# Start cloudflared tunnel
cloudflared tunnel --url "http://localhost:$API_PORT" > "$LOG_DIR/nova-voice-tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "Tunnel started (PID: $TUNNEL_PID)"

# Wait for tunnel URL
sleep 5
TUNNEL_URL=$(grep -o 'https://[a-z-]*\.trycloudflare\.com' "$LOG_DIR/nova-voice-tunnel.log" | head -1)

if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "🎙️ Nova Voice Bridge active!"
    echo "   API:  http://localhost:$API_PORT"
    echo "   URL:  $TUNNEL_URL"
    echo ""
    echo "   Tell Nova to update the PWA with this URL!"
else
    echo "⚠️  Tunnel URL not found yet. Check logs: $LOG_DIR/nova-voice-tunnel.log"
    echo "   Tunnel PID: $TUNNEL_PID"
fi

# Wait for either process to exit
wait
