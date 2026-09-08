/**
 * 6 Functional Physical Mobility Tests Module for OA Screening
 * Manages test protocols, countdown timers, sensor data capture, and score calculations.
 */

window.OAMobilityTests = {
  activeTestId: null,
  testTimer: null,
  elapsedSeconds: 0,
  isRecording: false,

  // Captured Data Buffer during a test run
  currentBuffer: [],

  // Completed Test Results Storage
  results: {
    sit_to_stand: null,
    squats: null,
    gait: null,
    balance: null,
    stairs: null,
    rom: null
  },

  testDefinitions: {
    sit_to_stand: {
      name: "30-Second Sit-to-Stand Test",
      category: "Quadriceps Power & Extension",
      duration: 30,
      instructions: "Patient sits on a standard chair with arms crossed. Upon starting, perform full stands and sits repeatedly for 30 seconds.",
      simMode: 'sit_to_stand'
    },
    squats: {
      name: "Deep Squat Mobility & Bilateral Balance",
      category: "Patellofemoral & Weight Distribution",
      duration: 20,
      instructions: "Patient performs 5 controlled bodyweight squats. Wearable sensors measure deep flexion range and left-vs-right foot load shift.",
      simMode: 'squat'
    },
    gait: {
      name: "Timed Gait & Stride Dynamics (TUG / 10M)",
      category: "Gait Asymmetry & Stance Ratio",
      duration: 20,
      instructions: "Patient walks normally at comfortable pace for 10 meters. Sensors track heel-strike impact force, angular velocity, and step asymmetry.",
      simMode: 'gait'
    },
    balance: {
      name: "Single Leg Stance Balance (Left vs Right)",
      category: "Joint Stability & Center of Pressure",
      duration: 15,
      instructions: "Patient stands on left leg for 15s while holding right leg flexed, then repeat for right leg. Sensors evaluate postural sway & COP shift.",
      simMode: 'balance'
    },
    stairs: {
      name: "Stair Ascent/Descent Stepping Test",
      category: "Dynamic Impact & High Flexion Load",
      duration: 20,
      instructions: "Patient ascends and descends a 3-step stair flight. Measures peak heel-strike acceleration and joint damping capacity.",
      simMode: 'stairs'
    },
    rom: {
      name: "Passive / Active Knee ROM Flex/Extension",
      category: "Joint Range & Motion Smoothness",
      duration: 15,
      instructions: "Patient extends knee fully (0°) then flexes as far as comfortably possible. Measures max flexion deficit and angular speed jerk index.",
      simMode: 'rom'
    }
  },

  init: function() {
    // Subscribe to hardware sensor streamer
    OAHardwareStreamer.subscribe((sensorData) => {
      if (this.isRecording) {
        this.currentBuffer.push(sensorData);
      }
      this.updateLiveDisplays(sensorData);
    });
  },

  selectTest: function(testId) {
    if (!this.testDefinitions[testId]) return;
    this.activeTestId = testId;
    const def = this.testDefinitions[testId];
    
    // Switch simulator mode to match selected test
    OAHardwareStreamer.setSimulationMode(def.simMode);

    // Update UI elements for test setup
    const titleEl = document.getElementById("activeTestTitle");
    const catEl = document.getElementById("activeTestCategory");
    const instEl = document.getElementById("activeTestInstructions");
    const durEl = document.getElementById("activeTestTimerDisplay");

    if (titleEl) titleEl.textContent = def.name;
    if (catEl) catEl.textContent = def.category;
    if (instEl) instEl.textContent = def.instructions;
    if (durEl) durEl.textContent = `${def.duration}s`;
  },

  startTestRun: function() {
    if (!this.activeTestId) this.selectTest("sit_to_stand");
    const def = this.testDefinitions[this.activeTestId];

    this.isRecording = true;
    this.currentBuffer = [];
    this.elapsedSeconds = 0;

    const timerEl = document.getElementById("activeTestTimerDisplay");
    const startBtn = document.getElementById("btnStartTestRun");
    const stopBtn = document.getElementById("btnStopTestRun");

    if (startBtn) startBtn.classList.add("hidden");
    if (stopBtn) stopBtn.classList.remove("hidden");

    if (this.testTimer) clearInterval(this.testTimer);
    this.testTimer = setInterval(() => {
      this.elapsedSeconds++;
      const remaining = def.duration - this.elapsedSeconds;
      if (timerEl) timerEl.textContent = `${Math.max(0, remaining)}s`;

      if (this.elapsedSeconds >= def.duration) {
        this.finishTestRun();
      }
    }, 1000);
  },

  finishTestRun: function() {
    this.isRecording = false;
    if (this.testTimer) {
      clearInterval(this.testTimer);
      this.testTimer = null;
    }

    const startBtn = document.getElementById("btnStartTestRun");
    const stopBtn = document.getElementById("btnStopTestRun");
    if (startBtn) startBtn.classList.remove("hidden");
    if (stopBtn) stopBtn.classList.add("hidden");

    // Process captured data buffer and compute mobility metrics
    const analysis = this.analyzeBuffer(this.activeTestId, this.currentBuffer);

    if (analysis.incomplete) {
      this.renderTestCardResult(this.activeTestId, analysis);
      alert(`No sensor data was captured during "${this.testDefinitions[this.activeTestId].name}". Please start the Bio-Simulator or connect the ESP32 hardware, then run the test again.`);
      return; // don't store a fake result or refresh the report with it
    }

    this.results[this.activeTestId] = analysis;
    this.renderTestCardResult(this.activeTestId, analysis);
    alert(`Test "${this.testDefinitions[this.activeTestId].name}" completed successfully! Score: ${analysis.score}/100 (${analysis.rating})`);

    // Keep the Clinical Report in sync with the latest mobility data, if a
    // patient has already been entered.
    if (typeof window.regenerateReport === "function" && window.OACurrentPatientRecord) {
      try {
        // Re-render only (don't force-navigate away from the current tab)
        const current = window.OACurrentPatientRecord;
        const assessment = OAAIEngine.evaluateRisk(current.input, this.results);
        current.assessment = assessment;
        current.mobilityResults = this.results;
        OADashboard.saveRecord(current);
        OAReportGenerator.renderReport(current);
      } catch (err) {
        console.error("Could not auto-refresh report after mobility test:", err);
      }
    }
  },

  analyzeBuffer: function(testId, buffer) {
    if (!buffer || buffer.length === 0) {
      // No sensor samples were captured at all -- this means neither the
      // Bio-Simulator nor real ESP32 hardware was actively streaming
      // during the test window. Rather than fabricate a fake result, we
      // flag it clearly so the clinician knows to re-run the test.
      return {
        score: null,
        rating: "No Sensor Data Captured",
        maxKneeFlexionL: 0,
        maxKneeFlexionR: 0,
        asymmetryIndex: 0,
        avgFsrL: [0, 0],
        avgFsrR: [0, 0],
        confidence: 0,
        flags: ["No data captured -- start the Bio-Simulator or connect ESP32 hardware before running this test."],
        incomplete: true
      };
    }

    let maxFlexL = 0, maxFlexR = 0;
    let maxVelL = 0, maxVelR = 0;
    let totalFsrL = [0, 0]; // [medial, lateral]
    let totalFsrR = [0, 0]; // [medial, lateral]
    let velSamples = []; // combined (L+R)/2 angular velocity per sample, for jerk/variability
    let goodSensorSamples = 0;

    buffer.forEach(pkt => {
      let vL = 0, vR = 0;
      if (pkt.left_leg) {
        maxFlexL = Math.max(maxFlexL, pkt.left_leg.knee_angle || 0);
        vL = pkt.left_leg.angular_velocity || 0;
        maxVelL = Math.max(maxVelL, vL);
        if (pkt.left_leg.fsr) {
          pkt.left_leg.fsr.forEach((v, i) => totalFsrL[i] += v);
        }
      }
      if (pkt.right_leg) {
        maxFlexR = Math.max(maxFlexR, pkt.right_leg.knee_angle || 0);
        vR = pkt.right_leg.angular_velocity || 0;
        maxVelR = Math.max(maxVelR, vR);
        if (pkt.right_leg.fsr) {
          pkt.right_leg.fsr.forEach((v, i) => totalFsrR[i] += v);
        }
      }
      velSamples.push((vL + vR) / 2);

      const lOk = !pkt.left_leg || pkt.left_leg.sensorsOk !== false;
      const rOk = !pkt.right_leg || pkt.right_leg.sensorsOk !== false;
      if (lOk && rOk) goodSensorSamples++;
    });

    const count = buffer.length;
    const avgFsrL = totalFsrL.map(v => Math.round(v / count));
    const avgFsrR = totalFsrR.map(v => Math.round(v / count));
    const confidence = Math.round((goodSensorSamples / count) * 100);

    // Calculate Gait / Load Asymmetry Index (%) -- real feature, from real data
    const totalLoadL = avgFsrL.reduce((a, b) => a + b, 0);
    const totalLoadR = avgFsrR.reduce((a, b) => a + b, 0);
    const totalBoth = totalLoadL + totalLoadR || 1;
    const asymmetryIndex = Math.abs(totalLoadL - totalLoadR) / totalBoth * 100;

    // Medial vs Lateral Plantar Ratio -- real feature
    const medialL = avgFsrL[0], lateralL = avgFsrL[1];
    const medialR = avgFsrR[0], lateralR = avgFsrR[1];
    const medialTotal = medialL + medialR, lateralTotal = lateralL + lateralR;
    const medLatImbalance = lateralTotal > 0 ? Math.abs((medialTotal / lateralTotal) - 1) : (medialTotal > 0 ? 1.2 : 0);

    // Range-of-motion deficit vs a 130-degree healthy-reference flexion -- real feature
    const worseFlexion = Math.min(maxFlexL, maxFlexR);
    const romDeficit = Math.max(0, 130 - worseFlexion);

    // Movement smoothness / jerk proxy: standard deviation of combined
    // angular velocity across the captured buffer -- real feature
    const velMean = velSamples.reduce((a, b) => a + b, 0) / (velSamples.length || 1);
    const velVariance = velSamples.reduce((a, b) => a + (b - velMean) ** 2, 0) / (velSamples.length || 1);
    const velocityVariability = Math.sqrt(velVariance);

    // --- Run the ML inference engine using this specific test's clinical
    // weight profile (see TEST_WEIGHT_PROFILES in ml-inference-engine.js).
    // Each of the 6 tests emphasizes different sensor features -- e.g.
    // the ROM test weighs flexion deficit heavily, the Balance test
    // weighs medial/lateral sway and velocity variability heavily -- so
    // the six cards genuinely differ based on what each test measures,
    // not from an arbitrary per-test constant. Score is purely a
    // function of real sensor data, mapped into the 70-90 screening
    // display band.
    const inference = OAInferenceEngine.inferForTest(testId, {
      asymmetry: asymmetryIndex,
      romDeficit: romDeficit,
      medLatImbalance: medLatImbalance,
      velocityVariability: velocityVariability
    });

    const score = OAInferenceEngine.bsiToFunctionalScore(inference.biomechanicalStressIndex, 70, 90);

    let flags = [];
    if (worseFlexion < 90) flags.push("Knee Flexion Deficit (< 90°)");
    if (asymmetryIndex > 15) flags.push(`High Bilateral Load Asymmetry (${asymmetryIndex.toFixed(1)}%)`);
    else if (asymmetryIndex > 8) flags.push(`Mild Load Asymmetry (${asymmetryIndex.toFixed(1)}%)`);
    if (medialTotal > lateralTotal * 1.6) flags.push("Medial Plantar Overload (Varus Joint Alignment Marker)");
    else if (lateralTotal > medialTotal * 1.6) flags.push("Lateral Plantar Overload (Valgus Alignment Marker)");
    if (confidence < 80) flags.push(`Reduced Sensor Confidence (${confidence}% valid samples)`);

    let rating;
    if (score >= 86) rating = "Low Risk / High Functional Mobility";
    else if (score >= 78) rating = "Mild Functional Deficit / Early Marker";
    else rating = "Moderate Biomechanical Deficit";

    return {
      score: score,
      rating: rating,
      maxKneeFlexionL: Math.round(maxFlexL),
      maxKneeFlexionR: Math.round(maxFlexR),
      maxAngularSpeedL: Math.round(maxVelL),
      maxAngularSpeedR: Math.round(maxVelR),
      asymmetryIndex: parseFloat(asymmetryIndex.toFixed(1)),
      medLatImbalance: parseFloat(medLatImbalance.toFixed(2)),
      romDeficit: Math.round(romDeficit),
      velocityVariability: Math.round(velocityVariability * 10) / 10,
      avgFsrL: avgFsrL,
      avgFsrR: avgFsrR,
      confidence: confidence,
      biomechanicalStressIndex: inference.biomechanicalStressIndex,
      featureContributions: inference.featureContributions,
      modelVersion: inference.modelVersion,
      flags: flags
    };
  },

  updateLiveDisplays: function(data) {
    const lAngleEl = document.getElementById("liveLeftKneeAngle");
    const rAngleEl = document.getElementById("liveRightKneeAngle");
    const lVelEl = document.getElementById("liveLeftAngularVelocity");
    const rVelEl = document.getElementById("liveRightAngularVelocity");
    const asymmetryEl = document.getElementById("liveGaitAsymmetry");

    if (lAngleEl) lAngleEl.textContent = `${data.left_leg.knee_angle}°`;
    if (rAngleEl) rAngleEl.textContent = `${data.right_leg.knee_angle}°`;
    if (lVelEl) lVelEl.textContent = `${data.left_leg.angular_velocity} deg/s`;
    if (rVelEl) rVelEl.textContent = `${data.right_leg.angular_velocity} deg/s`;

    // Live FSR Heatmap Pressure Bars (2 sensors per leg: medial, lateral)
    const fsrIdsL = ["liveFsrL_medial", "liveFsrL_lateral"];
    const fsrIdsR = ["liveFsrR_medial", "liveFsrR_lateral"];

    (data.left_leg.fsr || []).forEach((val, i) => {
      const textEl = document.getElementById(fsrIdsL[i]);
      const barEl = document.getElementById(`${fsrIdsL[i]}_bar`);
      if (textEl) textEl.textContent = `${val}N`;
      if (barEl) barEl.style.width = `${Math.min(100, val)}%`;
    });

    (data.right_leg.fsr || []).forEach((val, i) => {
      const textEl = document.getElementById(fsrIdsR[i]);
      const barEl = document.getElementById(`${fsrIdsR[i]}_bar`);
      if (textEl) textEl.textContent = `${val}N`;
      if (barEl) barEl.style.width = `${Math.min(100, val)}%`;
    });

    // Per-leg hardware/simulated source indicator (if present in HTML)
    const srcL = document.getElementById("liveLeftDataSource");
    const srcR = document.getElementById("liveRightDataSource");
    if (srcL) srcL.textContent = data.left_leg.source === 'hardware' ? "Live USB" : "Simulated";
    if (srcR) srcR.textContent = data.right_leg.source === 'hardware' ? "Live USB" : "Simulated";

    // Compute live weight asymmetry ratio
    const sumL = data.left_leg.fsr.reduce((a, b) => a + b, 0);
    const sumR = data.right_leg.fsr.reduce((a, b) => a + b, 0);
    const total = sumL + sumR || 1;
    const diff = Math.abs(sumL - sumR) / total * 100;

    if (asymmetryEl) {
      asymmetryEl.textContent = `${diff.toFixed(1)}%`;
      asymmetryEl.className = diff > 15 ? "text-rose-600 font-extrabold" : diff > 8 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold";
    }
  },

  renderTestCardResult: function(testId, res) {
    const cardEl = document.getElementById(`testCardResult-${testId}`);
    if (!cardEl) return;

    if (res.incomplete) {
      cardEl.innerHTML = `
        <div class="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs">
          <div class="font-bold text-amber-900">No Sensor Data Captured</div>
          <p class="text-amber-700 mt-1">${res.flags[0]}</p>
        </div>
      `;
      return;
    }

    cardEl.innerHTML = `
      <div class="mt-3 p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs">
        <div class="flex items-center justify-between font-bold text-teal-900">
          <span>Score: ${res.score}/100</span>
          <span class="px-2 py-0.5 rounded bg-teal-200 text-teal-800">${res.rating}</span>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-slate-700">
          <div>Max Flex L/R: <strong>${res.maxKneeFlexionL}° / ${res.maxKneeFlexionR}°</strong></div>
          <div>Asymmetry: <strong>${res.asymmetryIndex}%</strong></div>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span>ML Stress Index: <strong class="text-slate-700">${res.biomechanicalStressIndex}</strong>/100</span>
          <span>Sensor Confidence: <strong class="${res.confidence >= 80 ? 'text-emerald-700' : 'text-amber-700'}">${res.confidence}%</strong></span>
        </div>
        ${res.flags && res.flags.length > 0 ? `
          <div class="mt-2 text-rose-700 font-semibold text-[11px]">
            Marker: ${res.flags.join(", ")}
          </div>
        ` : ''}
      </div>
    `;
  }
};
