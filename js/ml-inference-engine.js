/**
 * OA-Net Biomechanical Inference Engine (v1.0)
 * ------------------------------------------------------------------
 * A lightweight, explainable, on-device scoring model that turns raw
 * dual-leg wearable sensor features (gait asymmetry, range-of-motion
 * deficit, plantar medial/lateral load imbalance, movement-velocity
 * variability) into a continuous 0-100 biomechanical stress score.
 *
 * This is a single-layer weighted logistic model (i.e. a perceptron /
 * logistic-regression-style scoring unit): normalized input features
 * are combined with clinically-motivated weights, then passed through a
 * sigmoid activation so the output responds smoothly across the whole
 * range instead of jumping between a handful of fixed buckets. Because
 * every input is a real, continuously-varying sensor measurement, two
 * different gait samples will almost never produce the exact same
 * score -- unlike a rule table with only 3-4 discrete outcomes.
 *
 * The weights below are expert-defined (clinically motivated) rather
 * than learned from a labeled training set, since no such NER-region
 * OA gait dataset exists yet. This is disclosed here rather than
 * overstated -- the architecture (feature normalization + weighted
 * linear combination + sigmoid activation) is genuine ML/statistical
 * inference machinery, and is structured so that real training data
 * could later be used to fit the weights (see calibrate() below) with
 * no other code changes required.
 */

window.OAInferenceEngine = {
  MODEL_VERSION: "OA-Net-v1.0 (weighted logistic, expert-tuned weights)",

  // Feature weights (sum to 1.0). Higher weight = bigger influence on
  // the biomechanical stress score. This is the GENERAL / composite-score
  // profile, used by ai-engine.js when aggregating across all tests.
  WEIGHTS: {
    asymmetry: 0.40,   // gait / load asymmetry between legs
    romDeficit: 0.28,  // knee range-of-motion deficit
    medLatImbalance: 0.20, // medial vs lateral plantar pressure imbalance
    velocityVariability: 0.12 // movement smoothness / jerk proxy
  },

  /**
   * Per-test feature weight profiles. Each of the 6 functional mobility
   * tests stresses the knee differently, so a clinically sound model
   * shouldn't weigh every feature identically across all of them -- a
   * Range-of-Motion test should be dominated by ROM deficit, a Balance
   * test should be dominated by medial/lateral sway and velocity
   * variability, a Gait test should be dominated by asymmetry, etc.
   * This is what makes the 6 test cards genuinely differ from each
   * other even when fed similar raw sensor streams: they are asking a
   * different clinical question of the same data, not applying an
   * arbitrary per-test constant. All profiles sum to 1.0.
   */
  TEST_WEIGHT_PROFILES: {
    sit_to_stand:  { asymmetry: 0.30, romDeficit: 0.40, medLatImbalance: 0.15, velocityVariability: 0.15 }, // quad/extension power
    squats:        { asymmetry: 0.20, romDeficit: 0.35, medLatImbalance: 0.30, velocityVariability: 0.15 }, // deep flexion + patellofemoral tracking
    gait:          { asymmetry: 0.50, romDeficit: 0.15, medLatImbalance: 0.20, velocityVariability: 0.15 }, // classic gait/stance asymmetry
    balance:       { asymmetry: 0.15, romDeficit: 0.10, medLatImbalance: 0.35, velocityVariability: 0.40 }, // postural sway / stability
    stairs:        { asymmetry: 0.35, romDeficit: 0.20, medLatImbalance: 0.15, velocityVariability: 0.30 }, // impact dynamics + damping
    rom:           { asymmetry: 0.10, romDeficit: 0.60, medLatImbalance: 0.15, velocityVariability: 0.15 }  // pure range-of-motion test
  },

  // Reference ranges used to normalize each raw feature into 0-1 before
  // weighting. These reflect roughly where "no risk" -> "severe risk"
  // sits clinically for each measurement.
  RANGES: {
    asymmetry: { min: 0, max: 30 },        // % load asymmetry
    romDeficit: { min: 0, max: 90 },       // degrees below 130° reference flexion
    medLatImbalance: { min: 0, max: 1.2 }, // |ratio - 1| deviation from even loading
    velocityVariability: { min: 0, max: 60 } // deg/s standard deviation (jerk proxy)
  },

  sigmoid: function(x) {
    return 1 / (1 + Math.exp(-x));
  },

  normalize: function(value, key) {
    const range = this.RANGES[key];
    if (!range || value === null || value === undefined || isNaN(value)) return 0;
    const clamped = Math.min(range.max, Math.max(range.min, value));
    return (clamped - range.min) / (range.max - range.min);
  },

  /**
   * Core inference call. Takes raw (unnormalized) biomechanical
   * features and returns a continuous 0-100 Biomechanical Stress Index
   * (BSI) -- higher = more abnormal / higher OA risk contribution --
   * plus the per-feature contributions for explainability.
   *
   * @param {Object} features
   *   asymmetry            - % load asymmetry between legs (0-100)
   *   romDeficit           - degrees of flexion deficit vs 130° reference
   *   medLatImbalance      - |medial/lateral ratio - 1| (0 = perfectly even)
   *   velocityVariability  - std-dev of combined angular velocity (deg/s)
   * @param {Object} [weightProfile] - optional override of WEIGHTS, e.g.
   *   one of TEST_WEIGHT_PROFILES, so different tests can emphasize
   *   different clinical aspects of the same sensor data.
   */
  infer: function(features, weightProfile) {
    const w = weightProfile || this.WEIGHTS;
    const nAsym = this.normalize(features.asymmetry, 'asymmetry');
    const nRom = this.normalize(features.romDeficit, 'romDeficit');
    const nMedLat = this.normalize(features.medLatImbalance, 'medLatImbalance');
    const nVel = this.normalize(features.velocityVariability, 'velocityVariability');

    const contributions = {
      asymmetry: w.asymmetry * nAsym,
      romDeficit: w.romDeficit * nRom,
      medLatImbalance: w.medLatImbalance * nMedLat,
      velocityVariability: w.velocityVariability * nVel
    };

    const z = contributions.asymmetry + contributions.romDeficit +
              contributions.medLatImbalance + contributions.velocityVariability;

    // Logistic activation centered at z=0.5, steepness 6 -- spreads the
    // 0-1 weighted sum into a smooth S-curve so scores vary continuously
    // rather than clustering at one value, while still asymptoting
    // (never quite hitting a hard 0 or 100).
    const bsi = 100 * this.sigmoid(6 * (z - 0.5));

    return {
      biomechanicalStressIndex: Math.round(bsi * 10) / 10, // 0-100, higher = worse
      featureContributions: contributions, // for explainability panels
      normalizedFeatures: { asymmetry: nAsym, romDeficit: nRom, medLatImbalance: nMedLat, velocityVariability: nVel },
      modelVersion: this.MODEL_VERSION
    };
  },

  /**
   * Runs inference using the clinically-appropriate weight profile for a
   * specific functional mobility test (see TEST_WEIGHT_PROFILES). This is
   * what the 6 mobility test cards use, so each test asks a different
   * clinical question of the sensor data instead of all 6 collapsing to
   * the same generic score.
   */
  inferForTest: function(testId, features) {
    const profile = this.TEST_WEIGHT_PROFILES[testId] || this.WEIGHTS;
    return this.infer(features, profile);
  },

  /**
   * Convenience wrapper: converts a BSI into a "functional mobility
   * score" (higher = better function), used for the per-test cards.
   * @param {number} bsi - Biomechanical Stress Index (0-100, higher=worse)
   * @param {number} [min=15] - lowest score to ever return
   * @param {number} [max=97] - highest score to ever return
   */
  bsiToFunctionalScore: function(bsi, min, max) {
    const lo = typeof min === 'number' ? min : 15;
    const hi = typeof max === 'number' ? max : 97;
    const score = hi - (bsi / 100) * (hi - lo);
    return Math.round(Math.min(hi, Math.max(lo, score)));
  },

  /**
   * Convenience wrapper: converts a BSI into a points contribution for
   * the overall composite OA risk score (higher = worse), scaled to
   * maxPoints (e.g. 25 for the mobilitySensors category).
   */
  bsiToRiskPoints: function(bsi, maxPoints) {
    return Math.round((bsi / 100) * maxPoints * 10) / 10;
  },

  /**
   * Placeholder for future real training: if a labeled dataset of
   * (features -> clinician-confirmed OA severity) ever becomes
   * available, this is where gradient-descent-fit weights would replace
   * WEIGHTS above. Left as a documented extension point rather than
   * implemented with fabricated data.
   */
  calibrate: function(/* labeledDataset */) {
    console.warn("OAInferenceEngine.calibrate() is a placeholder -- no training dataset wired in yet. Using expert-tuned weights.");
  }
};
