# NER-OA Detect

**AI-assisted early screening for knee Osteoarthritis (OA) risk, built for India's North Eastern Region (NER).**

[![Deploy to GitHub Pages](https://github.com/YOUR-USERNAME/YOUR-REPO/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/YOUR-USERNAME/YOUR-REPO/actions/workflows/deploy-pages.yml)
[![CI Checks](https://github.com/YOUR-USERNAME/YOUR-REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/YOUR-REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Live Demo →](https://YOUR-USERNAME.github.io/YOUR-REPO/)** *(update this link after enabling GitHub Pages — see below)*

---

## What this is

A browser-based clinical screening tool that combines a patient intake form,
6 functional mobility tests, and a dual-leg ESP32 wearable sensor rig (2×
IMU + 2× FSR per leg) into a single AI-driven Osteoarthritis risk score and
downloadable clinical report — with particular attention to risk factors
common in NER India (hilly-terrain walking, squatting-heavy daily life,
manual load carrying).

No hardware? The built-in **Bio-Simulator** generates realistic gait/sensor
data so the whole app — intake, AI scoring, mobility tests, and the report —
works immediately in any browser, no ESP32 required. This is what the public
demo link above runs.

## Features

- **Multi-step patient intake** — demographics, BMI, NER-specific
  occupational/environmental risk factors, clinical symptoms.
- **On-device ML inference engine** — a weighted logistic-regression-style
  model turns real sensor features (gait asymmetry, ROM deficit,
  medial/lateral load imbalance, movement smoothness) into a continuous,
  explainable risk score — not a lookup table. See
  [`docs/ML_SCORING_AND_FIXES.md`](docs/ML_SCORING_AND_FIXES.md) for the
  full methodology.
- **6 functional mobility tests** (Sit-to-Stand, Squat, Gait, Balance,
  Stairs, Range-of-Motion), each with its own clinically-motivated feature
  weighting so results are meaningfully different per test, not a single
  generic number repeated six times.
- **Dual-leg ESP32 hardware support** — two independent USB/WebSerial
  connections (one board per leg), auto-falls-back to simulated data for
  any leg without hardware attached. See
  [`docs/HARDWARE_CHANGES.md`](docs/HARDWARE_CHANGES.md).
- **Clinical report generator** — risk score, diagnosed OA subtype
  (medial/lateral/patellofemoral compartment), explainability breakdown,
  recommendations, exportable to PDF.
- **Clinician dashboard** — patient registry with CSV export, all stored
  locally in the browser (see Privacy below).
- **Raspberry Pi 5 ready** — one-command setup script, USB permission
  handling, Chromium kiosk launcher. See
  [`docs/RASPBERRY_PI_SETUP.md`](docs/RASPBERRY_PI_SETUP.md).

## Privacy & data handling

This app stores all patient data **only in the browser's local storage on
the device it's running on** — nothing is sent to a server, and there is no
backend database. This makes it safe to host publicly (e.g., on GitHub
Pages) for demo/screening purposes: each visitor's data stays on their own
device and is never visible to anyone else, including the people who
deployed the site. If you fork this for a real clinical deployment with
centralized patient records, you will need to add a proper backend with
authentication and encryption — this repo does not include one by design.

## Quick start

### Try it online
Just open the [live demo](https://YOUR-USERNAME.github.io/YOUR-REPO/) —
no install needed. Use "Launch Bio-Simulator" on the Hardware tab to see
the full flow without physical sensors.

### Run it locally
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
python3 server.py
```
Then open `http://localhost:8000`. (Or just open `index.html` directly in
a browser — everything is static, no build step.)

### Run it on a Raspberry Pi 5
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
bash setup-pi.sh
sudo reboot
./start-dashboard.sh
```
Full walkthrough, including ESP32 USB permissions and autostart, in
[`docs/RASPBERRY_PI_SETUP.md`](docs/RASPBERRY_PI_SETUP.md).

### Flash the ESP32 hardware
Firmware lives in [`esp32_firmware/esp32_single_leg_hardware.ino`](esp32_firmware/esp32_single_leg_hardware.ino).
Flash the **same file** to both boards, only changing the `LEG_SIDE`
constant at the top (`"left"` / `"right"`) before each upload. Wiring
diagrams are in the app's own "ESP32 Guide" tab and in
[`docs/HARDWARE_CHANGES.md`](docs/HARDWARE_CHANGES.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, Tailwind CSS (CDN), Chart.js, html2pdf.js |
| AI/ML | Custom lightweight weighted-logistic inference engine (`js/ml-inference-engine.js`) — no external ML framework, runs entirely client-side |
| Hardware | ESP32 (Arduino C++), MPU6050 IMUs, FSR pressure sensors, WebSerial API |
| Local server | Python 3 standard library (`http.server`) — no dependencies to install |
| Hosting | Static — deployable to GitHub Pages, Vercel, Netlify, or any static host |

## Project structure

```
.
├── index.html                     # Main app shell (all tabs/UI)
├── css/styles.css                 # Custom styles
├── js/
│   ├── ml-inference-engine.js     # On-device ML scoring model
│   ├── ai-engine.js               # Composite OA risk scoring
│   ├── hardware-streamer.js       # Dual-leg WebSerial + simulator
│   ├── mobility-tests.js          # 6 functional test protocols
│   ├── report-generator.js        # Clinical report rendering + PDF export
│   ├── dashboard.js                # Patient registry / CSV export
│   └── app.js                     # App orchestration
├── esp32_firmware/
│   └── esp32_single_leg_hardware.ino
├── server.py                      # Local dev server (localhost-only by default)
├── setup-pi.sh / start-dashboard.sh / ner-oa-dashboard.service   # Raspberry Pi tooling
└── docs/                          # Deep-dive documentation
```

## Deploying for many users

This is a static site, so it scales to any number of concurrent users on
any static host, at no cost, with no server to maintain:

- **GitHub Pages** (included, see `.github/workflows/deploy-pages.yml`):
  push to `main` and it auto-deploys. Enable it once under
  **Settings → Pages → Source: GitHub Actions**.
- **Vercel** / **Netlify**: import the repo, no build command needed,
  output directory is the repo root.

Since all patient data stays client-side (see Privacy above), there's no
database, quota, or per-user cost to worry about regardless of traffic.

## Medical disclaimer

This tool is intended for **research, education, and preliminary
screening support only**. It is **not** a certified or regulated medical
device, and its output does not constitute a diagnosis. Always refer
flagged or symptomatic patients to a qualified orthopedic clinician for
proper radiographic evaluation and diagnosis.

## Contributing

Issues and pull requests are welcome. Please run the syntax checks locally
before opening a PR:
```bash
for f in js/*.js; do node --check "$f"; done
python3 -m py_compile server.py
```

## License

[MIT](LICENSE) — see the license file for the medical-disclaimer note that
accompanies it.
