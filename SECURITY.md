# Security Policy

## Data handling model

This application stores all patient/user data **exclusively in the
browser's `localStorage` on the device running it**. There is no backend
server, no database, and no network transmission of patient data. This is
a deliberate design choice that makes the app safe to host publicly (e.g.
on GitHub Pages) — each user's data is isolated to their own browser and
is never visible to the site operator or other users.

If you fork this project to build a centralized/multi-clinic deployment,
you will need to add your own authenticated backend, encryption at rest
and in transit, and an access-control model appropriate to your
jurisdiction's health-data regulations (e.g. India's DPDP Act, HIPAA,
GDPR, etc., as applicable). This repository intentionally does not
include one.

## Known, mitigated risks (fixed in this codebase)

- **Stored XSS**: all user-entered text (patient name, district, state)
  is HTML-escaped before being inserted into the DOM.
- **CSV/formula injection**: CSV exports neutralize fields starting with
  `=`, `+`, `-`, `@`.
- **Local server exposure**: `server.py` binds to `127.0.0.1` (localhost
  only) by default; LAN access requires an explicit `--lan` flag.

## Reporting a vulnerability

If you find a security issue, please open a GitHub issue with the
`security` label, or contact the repository maintainer directly if the
issue could be actively exploited before a fix ships. Please avoid
publicly disclosing exploit details until a fix is available.

## Scope

This policy covers the application code in this repository. It does not
cover the ESP32 firmware's radio/Bluetooth stack (not used here — USB
serial only) or any third-party CDN dependency (Tailwind CSS, Chart.js,
html2pdf.js) beyond pinning reasonable versions.
