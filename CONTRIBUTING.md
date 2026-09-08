# Contributing

Thanks for considering a contribution! This is a small, dependency-light
static app, so the barrier to contributing is low.

## Getting set up

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
python3 server.py
```
No build step, no `npm install` — open `http://localhost:8000` and edit
files directly; refresh the browser to see changes.

## Before opening a PR

Run the same checks CI runs:
```bash
for f in js/*.js; do node --check "$f"; done
python3 -m py_compile server.py
```

## Areas that welcome contributions

- **ML model calibration** — `js/ml-inference-engine.js` documents a
  `calibrate()` extension point for fitting weights to real labeled data,
  if a labeled NER-region gait dataset ever becomes available.
  Currently weights are expert-tuned, not learned.
- **Additional mobility tests** — new test protocols can be added in
  `js/mobility-tests.js` (`testDefinitions`) plus a matching weight
  profile in `js/ml-inference-engine.js` (`TEST_WEIGHT_PROFILES`).
- **Additional languages** — the UI is currently English-only; NER has
  significant linguistic diversity, and localization would be valuable.
- **Accessibility** — screen-reader support and keyboard navigation
  improvements are welcome.
- **Backend/auth** for anyone wanting a real multi-clinic deployment (see
  `SECURITY.md` for why this repo doesn't ship one by default).

## Code style

- Vanilla JS, no framework, no build step — please keep it that way
  unless discussed in an issue first (keeping zero-install friction is a
  deliberate design goal).
- Match existing formatting/comment style in the file you're editing.
- Keep patient-data-handling code client-side only (see `SECURITY.md`).

## Reporting bugs

Please include: browser + OS, steps to reproduce, and (if relevant)
whether you were using the Bio-Simulator or real ESP32 hardware.
