# AI/ML Scoring Engine + Critical Bug Fixes

## The "always 70" bug — root cause found and fixed

There were actually **two compounding bugs**, not one:

1. **`analyzeBuffer()` in `mobility-tests.js`** had a hardcoded fallback:
   whenever a mobility test's sensor buffer was empty (e.g. FSR wasn't
   streaming), it silently returned a fixed fake result — `score: 82,
   asymmetryIndex: 4.2` — instead of reflecting the actual (missing)
   data. If mobility tests never had real data, the AI engine's
   mobility sub-score defaulted to a fixed `avgAsymmetry: 6.5%`, which
   landed in the same fixed bucket (`+= 2` points) every single time.
   Combined, this pinned the mobility contribution to a near-constant
   value regardless of what your sensors were actually doing.

2. **`report-generator.js` had a variable-shadowing bug**: the code
   declared `const eval = patientRecord.assessment` and then, further
   down in the same function, kept referencing `eval.score`,
   `eval.riskCategory`, etc. When I renamed that variable to
   `assessmentData` in the last round of fixes, I only updated the
   declaration and the first few usages — **the rest of the template
   silently kept referencing the global `eval` function instead of
   your assessment data**, so those fields rendered as `undefined`.
   This is fixed now — every reference in the file uses
   `assessmentData` consistently (verified with a full grep pass).

Both are fixed. The score is no longer bucketed or stale.

## New: OA-Net ML Inference Engine (`js/ml-inference-engine.js`)

This is a genuine (if intentionally lightweight and explainable) machine
learning component: a **weighted logistic regression / single-layer
perceptron scoring unit**.

**How it works:**
1. Four real, continuously-varying biomechanical features are extracted
   directly from the sensor buffer for each mobility test:
   - **Gait/load asymmetry** (%) — from FSR load totals, left vs right
   - **Range-of-motion deficit** (degrees) — from IMU knee flexion angle
   - **Medial/lateral plantar imbalance** — from FSR medial vs lateral ratio
   - **Movement-velocity variability** — standard deviation of angular
     velocity across the whole buffer (a "smoothness/jerk" proxy)
2. Each feature is normalized to 0–1 against a clinically-informed range.
3. The normalized features are combined with tuned weights (asymmetry
   40%, ROM deficit 28%, medial/lateral imbalance 20%, velocity
   variability 12%).
4. The weighted sum passes through a **sigmoid activation** to produce a
   smooth, continuous 0–100 "Biomechanical Stress Index" (BSI) — the
   same nonlinear squashing function used in a logistic regression /
   neural network output layer.
5. The BSI is converted into (a) a per-test functional mobility score
   for the Mobility tab, and (b) a points contribution (0–25) that feeds
   the overall composite OA risk score in `ai-engine.js`.

**Why this fixes your "score doesn't vary" complaint:** every one of the
four inputs comes straight from live sensor math, and the sigmoid curve
responds smoothly across its whole range — verified test run:

| Sensor scenario | Biomechanical Stress Index | Functional Score |
|---|---|---|
| Excellent gait | 6.9 | 93 |
| Good gait | 11.1 | 89 |
| Mild asymmetry | 18.1 | 82 |
| Moderate deficit | 30.8 | 69 |
| Elevated risk | 48.3 | 52 |
| High risk | 69.1 | 31 |
| Severe impairment | 86.5 | 15 |

Typical/normal sensor variation naturally lands in the 60–90s band you
asked for, while genuinely poor or excellent data can push outside it —
which is the correct clinical behavior (a screening tool shouldn't cap
its range artificially).

**Honesty about the model** (worth knowing for hackathon Q&A): the
weights are expert-defined/clinically-motivated, not learned from a
labeled training dataset — no such NER-region OA gait dataset exists
yet. The architecture (feature normalization → weighted combination →
sigmoid activation) is the same one used in a trained logistic
regression model, and `OAInferenceEngine.calibrate()` is a documented
extension point where real labeled data could later be used to fit the
weights via gradient descent with no other code changes. This is framed
as "on-device inference engine, expert-tuned weights" in the UI/report
rather than claiming it was trained on patient data, since that would be
inaccurate.

## Explainability panel (new, in the Clinical Report)
The report now shows a visual breakdown of exactly how each of the 5
scoring categories (Demographics, BMI, NER Regional, Clinical Symptoms,
Mobility Sensors/ML) contributed to the composite score, plus the raw
Biomechanical Stress Index and a plain-language description of which
sensor features drove it. This is good for hackathon judging — it shows
the model isn't a black box.

## Also fixed in this pass
- **Stored XSS**: patient-entered fields (name, district, state) were
  being inserted into the page via `innerHTML` without escaping, in both
  the report and the dashboard table. Any patient name containing HTML/JS
  would have executed. Added an `escapeHtml()` helper used everywhere
  patient-controlled text reaches the DOM.
- **CSV/formula injection**: dashboard CSV export now neutralizes fields
  starting with `=`, `+`, `-`, `@` (which Excel/Sheets can interpret as
  formulas) and properly escapes embedded quotes.
- **Server exposed patient data to the whole LAN by default**:
  `server.py` now binds to `127.0.0.1` (localhost only) unless you pass
  `--lan` explicitly.
- **Report never refreshed** after mobility tests completed. Added
  `window.regenerateReport()`, wired to auto-run after each mobility
  test and to a new "Refresh Report" button on the Report tab.
- **Empty/incomplete test handling**: if a mobility test is run with no
  simulator or hardware actively streaming, it's now clearly flagged as
  "No Sensor Data Captured" instead of silently faking a result.
- Wrapped the intake form submit handler in try/catch so a bad/missing
  field shows a clear error instead of failing silently.

## Files changed in this pass
- `js/ml-inference-engine.js` — new
- `js/ai-engine.js` — mobility sub-score now ML-driven
- `js/mobility-tests.js` — per-test scoring now ML-driven, no-data case fixed
- `js/report-generator.js` — eval bug fixed, XSS fixed, explainability panel added
- `js/dashboard.js` — eval bug fixed, XSS fixed, CSV injection fixed
- `js/app.js` — error handling, `regenerateReport()`
- `server.py` — localhost-only by default
- `index.html` — new script tag, Refresh Report button
