# Hardware Rework: Two Independent USB Ports (One ESP32 Per Leg)

This update changes the sensor architecture from **one ESP32 board reading
both legs** (4 IMUs + 8 FSRs through an I2C multiplexer) to **two separate
ESP32 boards, one per leg** (2 IMUs + 2 FSRs each), each connected on its
own USB port. This matches your actual hardware (2 MPU6050s + 2 FSRs per
board, as seen in your serial monitor) instead of the original assumed
4-IMU/8-FSR single-board design.

## What changed and why

### 1. Firmware: `esp32_firmware/esp32_single_leg_hardware.ino` (new)
Replaces the old `esp32_dual_leg_hardware.ino`. Key differences:
- **2 MPU6050s + 2 FSRs per board** (not 4 + 8) — no TCA9548A I2C
  multiplexer needed, since only 2 IMUs share the bus (addressed via each
  sensor's AD0 pin: 0x68 and 0x69).
- **One `LEG_SIDE` constant** at the top (`"left"` or `"right"`). Flash the
  exact same file to both boards, just change this one line before each
  upload.
- **Sends clean, tagged JSON** — `{"type":"leg_data","side":"left",...}` —
  instead of the old plain-text `MPU1 Accel...` debug print seen in your
  serial monitor. That plain-text format wasn't JSON at all, so the old
  dashboard code could never have parsed real values from it — this is the
  main reason the dashboard was only ever showing simulated/random data.
- **FSR startup calibration + smoothing** — at boot, the firmware samples
  the unloaded FSRs for ~300ms and stores that as a zero baseline; every
  reading afterward is a 6-sample moving average with that offset
  subtracted. This is what was making raw ADC readings look "random" —
  unfiltered analog pins are noisy, and without a zero baseline you get an
  arbitrary offset instead of a real 0N-100N reading.
- **Sensor-fault detection** — if an MPU6050 doesn't ACK on the I2C bus,
  `sensors_ok` is reported `false` instead of silently sending garbage
  numbers.

### 2. `js/hardware-streamer.js` (rewritten)
- `connectWebSerial()` (single port) → `connectLeg('left')` /
  `connectLeg('right')` (two independent ports). Each opens its own
  browser "choose a serial port" dialog, so you pick the Left board once
  and the Right board once.
- Each leg tracks its own connection state. **The bio-simulator only ever
  fills in data for a leg that is NOT connected to real hardware** — so
  connecting one real ESP32 no longer gets its readings overwritten by
  simulated noise, and the other leg can still show demo data if you
  haven't plugged that board in yet.
- `latestData.left_leg.fsr` / `.right_leg.fsr` are now **2-element arrays**
  `[medial, lateral]` instead of 4-element `[heel, medial, lateral, toe]`,
  matching the real hardware.
- Added `source: 'hardware' | 'simulated'` on each leg's data so the UI can
  show a LIVE vs SIMULATED badge.

### 3. `js/mobility-tests.js`
- FSR buffers/averages now use 2-element arrays.
- Medial/lateral overload check updated to read `fsr[0]`/`fsr[1]` (was
  `fsr[1]`/`fsr[2]` of the old 4-element array).
- **Fixed a pre-existing bug**: the live FSR bar-width update was setting
  `style.width` on the same `<span>` element used for the text label
  (`0N`), instead of the actual bar `<div>`. The pressure bars were never
  visually filling in correctly even in the old simulator. Now the text
  span and bar div are updated separately.

### 4. `js/ai-engine.js`
- Medial/lateral compartment-OA ratio calculation updated from
  `avgFsrL[1]`/`avgFsrL[2]` to `avgFsrL[0]`/`avgFsrL[1]` to match the new
  2-element FSR arrays. This ratio drives the Medial/Lateral Compartment
  Knee OA subtype classification, so this was important to get right.

### 5. `index.html`
- Hardware tab: one "Connect ESP32 WebSerial" button → two buttons,
  **"Connect Left Leg USB"** and **"Connect Right Leg USB"**, each calling
  `connectLeg()` for that side. Added a LIVE/SIMULATED status badge per
  leg panel and a "Data source" line under each FSR panel.
- FSR panels trimmed from 4 rows (Heel/Medial/Lateral/Toe) to 2
  (Medial/Lateral) per leg, matching the real sensor count.
- ESP32 Guide tab rewritten to document the new two-board wiring and the
  flash-twice-with-different-LEG_SIDE workflow.
- **Fixed a pre-existing bug**: `index.html` referenced `js/ai-engine.js`
  and `css/styles.css`, but the project files were flat (no `js/`/`css/`
  subfolders) — so none of the scripts or styles would have actually
  loaded. Files are now organized into `js/` and `css/` to match what the
  HTML expects.

## What did NOT change
`ai-engine.js`'s demographic/BMI/regional/clinical-symptom scoring,
`dashboard.js`, `report-generator.js`'s layout, and `app.js`'s intake form
handling are all untouched — this was a hardware-layer fix only.

## Migrating your wiring
If your current boards have the 2 FSRs wired to different pins than
GPIO34/GPIO35, just change `PIN_FSR_1` / `PIN_FSR_2` at the top of the
`.ino` file to match. If your 2 MPU6050s are on 0x68/0x69 via a different
mechanism than the AD0 pin (e.g. you're already using a multiplexer),
you'll need to add `tcaSelect()` calls back in — let me know your exact
wiring and I can adjust the firmware.
