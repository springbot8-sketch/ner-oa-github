# Running the NER OA Detection System on Raspberry Pi 5 (Raspberry Pi OS)

Good news: this app is a static HTML/CSS/JS front end plus a tiny Python
web server — nothing in it is Windows/Mac specific, so it runs on
Raspberry Pi OS with almost no changes. The one thing to get right is the
**ESP32 connection**, which uses the browser's Web Serial API. That API
only exists in **Chromium-based browsers** (Chromium, Chrome, Edge) —
not Firefox — and the Pi user needs permission to access the USB serial
port.

This folder is set up so you can just copy it to the Pi and go.

---

## 1. Get the files onto the Pi

Copy this whole folder to the Pi, e.g. into `/home/pi/ner-oa-pi`. Easiest
ways:
- USB drive: copy the folder, plug into the Pi, copy to `/home/pi/`.
- `scp` from another machine on the same network:
  ```bash
  scp -r ner-oa-pi pi@<pi-ip-address>:/home/pi/
  ```
- Or `git clone` if you push this to a repo first.

## 2. Run the one-time setup script

Open a terminal on the Pi, `cd` into the folder, and run:

```bash
cd ~/ner-oa-pi
bash setup-pi.sh
```

This will:
- Install Chromium if it isn't already present (Raspberry Pi OS usually
  ships with it by default).
- Add your user to the `dialout` group, which is what grants permission
  to read/write `/dev/ttyUSB0` or `/dev/ttyACM0` — the ESP32's USB serial
  port. **Without this step you'll get a "permission denied" or the
  device just won't show up in the WebSerial picker.**
- Create a double-clickable Desktop shortcut.

**If this is the first run, reboot afterward** so the group membership
change takes effect:

```bash
sudo reboot
```

## 3. Launch the dashboard

After rebooting, either:
- Double-click the **"NER OA Detection Dashboard"** icon on the Desktop, or
- Run it from a terminal:
  ```bash
  cd ~/ner-oa-pi
  ./start-dashboard.sh
  ```

This starts the local server and opens the dashboard in Chromium
(`http://localhost:8000`) in app mode (no address bar/tabs, just the
app). Closing the Chromium window stops the server automatically.

## 4. Connect the ESP32

1. Plug the ESP32 into the Pi's USB port.
2. Check Linux sees it:
   ```bash
   dmesg | tail -20
   ```
   You should see a line mentioning `ttyUSB0` (CP2102/CH340 boards) or
   `ttyACM0` (native USB boards). No extra driver installation is needed
   on Linux — the CP210x/CH34x kernel modules are built in.
3. In the dashboard, go to the **Hardware** tab and click
   **"Connect ESP32 WebSerial."** Chromium will show a port picker —
   select the `/dev/ttyUSB0` (or similar) entry and click Connect.
4. If you don't see the ESP32 hardware yet, click **"Launch
   Bio-Simulator"** instead to test the app with simulated sensor data.

> Flashing the firmware: `esp32_dual_leg_hardware.ino` is unchanged and
> still gets flashed to the ESP32 itself (from the Arduino IDE on any
> machine, including the Pi if you install `arduino-cli` or the Arduino
> IDE for ARM). It has nothing to do with the Pi's OS — it only matters
> that the ESP32 streams JSON over USB serial at 115200 baud, which it
> already does.

## 5. (Optional) Auto-start the server on boot

If you'd rather the backend server always be running in the background
(and just open Chromium manually when needed), you can install it as a
systemd service:

```bash
# Edit the paths inside ner-oa-dashboard.service first if your folder
# isn't at /home/pi/ner-oa-pi, then:
sudo cp ner-oa-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ner-oa-dashboard.service
```

Check it's running:
```bash
systemctl status ner-oa-dashboard.service
```

Then just open Chromium and go to `http://localhost:8000` any time —
no need to run the launcher script.

To remove it later:
```bash
sudo systemctl disable --now ner-oa-dashboard.service
sudo rm /etc/systemd/system/ner-oa-dashboard.service
```

---

## Troubleshooting

**"Connect ESP32 WebSerial" button does nothing / no browser prompt**
Make sure you're using Chromium, not Firefox — Web Serial isn't
supported in Firefox at all. `chromium --version` should be recent
(Raspberry Pi OS Bookworm ships one that supports it out of the box).

**Port picker is empty / ESP32 doesn't appear**
- Confirm `dmesg | tail` shows the device enumerating.
- Confirm your user is in the `dialout` group: `groups $USER`. If not,
  re-run `setup-pi.sh` and reboot.
- Make sure nothing else (Arduino IDE's Serial Monitor, `screen`, etc.)
  already has the port open — only one program can use it at a time.

**"Permission denied" opening the serial port**
Same fix as above — `dialout` group membership, then reboot/logout.

**Dashboard opens but hardware tab shows nothing moving**
Click "Launch Bio-Simulator" to confirm the app itself works, then
troubleshoot the physical ESP32 connection separately.

**Want to access the dashboard from a phone/laptop on the same Wi-Fi**
`server.py` already binds to all network interfaces. From another
device on the same network, go to `http://<pi-ip-address>:8000`. Note:
the Web Serial connection to the ESP32 only works on the device that's
physically plugged into the ESP32 (the Pi), since it's a USB API — so
do hardware connection from the Pi's own Chromium, and use another
device only for viewing the dashboard/reports/dashboard tab remotely.

---

## What stayed exactly the same

`index.html`, `styles.css`, `ai-engine.js`, `app.js`, `dashboard.js`,
`hardware-streamer.js`, `mobility-tests.js`, `report-generator.js`, and
`esp32_dual_leg_hardware.ino` are **unchanged** from the original
project — none of that code is OS-specific. Only `server.py` was
lightly adapted (to prefer launching Chromium specifically and bind to
all network interfaces), and `start-dashboard.sh`, `setup-pi.sh`, and
`ner-oa-dashboard.service` are new, Pi-specific convenience scripts.
