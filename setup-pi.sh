#!/bin/bash
# One-time setup script for Raspberry Pi 5 / Raspberry Pi OS
# Run with:  bash setup-pi.sh
set -e

echo "=== NER-OA Detection System: Raspberry Pi setup ==="

# 1. Make sure Chromium is installed (needed for Web Serial / ESP32 connection)
if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
  echo "Installing Chromium browser..."
  sudo apt update
  sudo apt install -y chromium-browser
else
  echo "Chromium already installed."
fi

# 2. Add the current user to the 'dialout' group so it can access
#    /dev/ttyUSB0 or /dev/ttyACM0 (the ESP32's USB serial port) without sudo.
if groups "$USER" | grep -qw dialout; then
  echo "$USER is already in the 'dialout' group."
else
  echo "Adding $USER to the 'dialout' group (required for USB serial access)..."
  sudo usermod -aG dialout "$USER"
  echo ">>> IMPORTANT: You must log out and back in (or reboot) for this to take effect."
fi

# 3. Make scripts executable
chmod +x start-dashboard.sh
chmod +x server.py 2>/dev/null || true

# 4. Create a Desktop shortcut so the dashboard can be launched with a double-click
DESKTOP_DIR="$HOME/Desktop"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$DESKTOP_DIR" ]; then
  cat > "$DESKTOP_DIR/OA-Dashboard.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=NER OA Detection Dashboard
Comment=Launch the AI-Assisted OA Risk Marker Portal
Exec=$APP_DIR/start-dashboard.sh
Icon=chromium-browser
Terminal=false
Categories=Utility;
EOF
  chmod +x "$DESKTOP_DIR/OA-Dashboard.desktop"
  echo "Desktop shortcut created: $DESKTOP_DIR/OA-Dashboard.desktop"
  echo "(You may need to right-click it once and choose 'Allow Launching' / 'Trust'.)"
fi

echo ""
echo "=== Setup complete ==="
echo "If this is the first time dialout was added, REBOOT NOW:  sudo reboot"
echo "After that, double-click the Desktop shortcut, or run:  ./start-dashboard.sh"
