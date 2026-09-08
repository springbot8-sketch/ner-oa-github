#!/bin/bash
# Start-Dashboard launcher for Raspberry Pi 5 / Raspberry Pi OS
# Double-click this (or run `./start-dashboard.sh` in a terminal) to launch
# the OA Detection dashboard. Closing the Chromium window will also stop
# the local server automatically.

cd "$(dirname "$0")" || exit 1

PORT=8000
URL="http://localhost:${PORT}"

echo "Starting local server on ${URL} ..."
python3 server.py --no-launch &
SERVER_PID=$!

# Give the server a moment to bind before opening the browser
sleep 1

CHROMIUM_BIN=$(command -v chromium-browser || command -v chromium || command -v google-chrome)

if [ -z "$CHROMIUM_BIN" ]; then
  echo "Chromium was not found on this system."
  echo "Install it with: sudo apt install -y chromium-browser"
  kill "$SERVER_PID" 2>/dev/null
  exit 1
fi

echo "Opening dashboard in Chromium ($CHROMIUM_BIN)..."
"$CHROMIUM_BIN" --app="$URL" --start-maximized --disable-session-crashed-bubble --disable-infobars

# When the Chromium window is closed, stop the background server too
echo "Chromium closed — stopping server..."
kill "$SERVER_PID" 2>/dev/null
