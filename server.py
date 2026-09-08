"""
AI-Assisted OA Risk Marker Portal (NER Region)
Raspberry Pi 5 / Raspberry Pi OS build of the local web server.

This is the same static-file server as the original project, with these
Pi-specific / security changes:
  1. Binds to 127.0.0.1 (localhost only) BY DEFAULT. This app stores real
     patient data (name, age, location, pain scores, etc.) with no login
     and no encryption -- exposing it to the whole Wi-Fi network by
     default would let anyone else on that network read patient records.
     Pass --lan if you specifically want other devices to reach it.
  2. It tries to launch the dashboard in Chromium specifically (using
     --app mode), instead of relying on "whatever the OS default browser
     is". The ESP32 hardware connection uses the Web Serial API, which
     Chromium supports and Firefox does not, so Chromium is required.

Run it with:  python3 server.py
  Add --lan   to also allow other devices on your network to connect.
  Add --no-launch to skip auto-opening a browser (used by start-dashboard.sh).
Stop it with: Ctrl+C
"""

import http.server
import socketserver
import subprocess
import shutil
import webbrowser
import os
import sys
import socket

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
URL = f"http://localhost:{PORT}"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    # Quiet down default logging noise a little
    def log_message(self, format, *args):
        sys.stderr.write("[server] " + (format % args) + "\n")


def find_chromium():
    """Look for a Chromium-based browser binary on this Raspberry Pi.
    Web Serial (used to talk to the ESP32) only works in Chromium-based
    browsers, so we prefer these over xdg-open / the system default."""
    candidates = [
        "chromium-browser",  # Raspberry Pi OS Bullseye/Bookworm package name
        "chromium",          # some distros / newer Pi OS builds
        "google-chrome",
        "google-chrome-stable",
    ]
    for name in candidates:
        path = shutil.which(name)
        if path:
            return path
    return None


def get_lan_ip():
    """Best-effort guess at this machine's LAN IP, for display purposes only."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "<this-pi's-ip-address>"
    finally:
        s.close()


def launch_browser():
    chromium_path = find_chromium()
    if chromium_path:
        print(f"  Launching Chromium ({chromium_path}) in app mode...")
        try:
            subprocess.Popen([
                chromium_path,
                f"--app={URL}",
                "--start-maximized",
                "--disable-session-crashed-bubble",
                "--disable-infobars",
            ])
            return
        except Exception as e:
            print(f"  Could not launch Chromium directly ({e}), falling back...")

    print("  Chromium not found on PATH — opening system default browser instead.")
    print("  NOTE: connecting the ESP32 hardware requires Chromium (Web Serial API).")
    webbrowser.open(URL)


if __name__ == "__main__":
    skip_launch = "--no-launch" in sys.argv
    allow_lan = "--lan" in sys.argv
    bind_addr = "0.0.0.0" if allow_lan else "127.0.0.1"

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((bind_addr, PORT), Handler) as httpd:
        print("================================================================")
        print("  AI-Assisted OA Risk Marker Portal (NER Region) is running!")
        print(f"  Local access:   {URL}")
        if allow_lan:
            print(f"  Network access: http://{get_lan_ip()}:{PORT}  (--lan enabled)")
            print("  WARNING: patient data is now reachable by anyone on this network.")
        else:
            print("  Network access: disabled (default). Run with --lan to allow other")
            print("  devices on this network to view the dashboard.")
        print("  (Use the local address on the Pi itself for ESP32 WebSerial.)")
        print("================================================================")
        if not skip_launch:
            launch_browser()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
