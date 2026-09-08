/**
 * Upgraded AI Risk Assessment & Diagnostic Subtype Classifier for Osteoarthritis (OA)
 * Integrates Patient Intake, North Eastern Region (NER) Risk Factors, Dual-Leg Hardware Wearable Metrics,
 * and 6 Functional Mobility Tests.
 */

window.OAAIEngine = {
  mlEngine: function() {
    if (!window.OAInferenceEngine) {
      throw new Error("OAInferenceEngine is not loaded -- make sure js/ml-inference-engine.js is included before ai-engine.js in index.html.");
    }
    return window.OAInferenceEngine;
  },

  getBMICategory: function(bmi) {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 23) return "Normal Weight";
    if (bmi < 27.5) return "Overweight (NER Cut-off)";
    if (bmi < 32) return "Class I Obesity";
    return "Class II/III Severe Obesity";
  },

  /**
   * Main Diagnostic & Evaluation Function
   * @param {Object} data - Patient intake form data
   * @param {Object} mobilityResults - Completed 6 functional mobility test results
   * @param {Object} sensorSummary - Hardware sensor stream summary
   * @returns {Object} Comprehensive Diagnostic Report
   */
  evaluateRisk: function(data, mobilityResults = {}, sensorSummary = null) {
    let compositeScore = 0;
    const factorBreakdown = {
      demographics: 0, // max 15
      physicalBmi: 0,  // max 20
      nerRegional: 0,  // max 20 (hilly terrain, squatting, load carrying)
      clinicalSymptoms: 0, // max 20 (pain, stiffness, crepitus)
      mobilitySensors: 0  // max 25 (hardware + 6 mobility tests)
    };

    const keyMarkers = [];
    const recommendations = [];

    // --- 1. Demographics (Max 15) ---
    const age = parseInt(data.age) || 0;
    if (age >= 65) {
      factorBreakdown.demographics += 12;
      keyMarkers.push({ name: "Advanced Age (≥ 65 yrs)", level: "High", detail: "Accelerated cartilage attrition with decreased chondrocyte repair capability." });
    } else if (age >= 50) {
      factorBreakdown.demographics += 8;
      keyMarkers.push({ name: "Moderate Age Risk (50-64 yrs)", level: "Moderate", detail: "Elevated vulnerability window for primary knee OA onset." });
    } else if (age >= 40) {
      factorBreakdown.demographics += 4;
    }

    if (data.gender === "female") {
      factorBreakdown.demographics += 3;
      if (age >= 45) {
        keyMarkers.push({ name: "Post-menopausal Female Hormonal Factor", level: "Moderate", detail: "Post-menopausal estrogen decline accelerates cartilage matrix thinning." });
      }
    }

    // --- 2. Physical & BMI (Max 20) ---
    const heightM = (parseFloat(data.height) || 165) / 100;
    const weightKg = parseFloat(data.weight) || 65;
    const bmi = weightKg / (heightM * heightM);

    if (bmi >= 32) {
      factorBreakdown.physicalBmi += 20;
      keyMarkers.push({ name: "Severe Obesity (BMI ≥ 32)", level: "Critical", detail: "Every additional 1 kg of body mass exerts 4 kg of extra mechanical force on knee joints." });
      recommendations.push("Engage in low-impact weight reduction under orthotic supervision to decrease weight-bearing knee load.");
    } else if (bmi >= 27.5) {
      factorBreakdown.physicalBmi += 14;
      keyMarkers.push({ name: "Class I Obesity / Elevated BMI (≥ 27.5)", level: "High", detail: "Heightened joint cartilage mechanical strain during gait." });
      recommendations.push("Target a 5-10% body weight reduction to significantly decelerate structural OA progression.");
    } else if (bmi >= 23) {
      factorBreakdown.physicalBmi += 7;
    }

    // --- 3. NER Regional & Environmental Stressors (Max 20) ---
    const terrainHours = parseFloat(data.hillyTerrainHours) || 0;
    if (terrainHours >= 4) {
      factorBreakdown.nerRegional += 8;
      keyMarkers.push({ name: "Frequent Hilly Terrain Walking (≥ 4 hrs/day)", level: "High", detail: "Repetitive incline/decline traversal on NER steep slopes creates high peak shear forces on patellofemoral cartilage." });
      recommendations.push("Utilize cushioned ergonomic trekking poles and supportive footwear during NER hill slope traversal.");
    } else if (terrainHours >= 2) {
      factorBreakdown.nerRegional += 4;
    }

    const squatting = data.squattingFrequency || "occasional";
    if (squatting === "frequent") {
      factorBreakdown.nerRegional += 7;
      keyMarkers.push({ name: "High Squatting Frequency (>120° Flexion)", level: "High", detail: "Deep squatting increases intra-articular knee pressure up to 8x body weight." });
      recommendations.push("Use raised seat adapters or commode stools to avoid chronic hyper-flexion squatting stress.");
    } else if (squatting === "moderate") {
      factorBreakdown.nerRegional += 3;
    }

    const loadHours = parseFloat(data.loadCarryingHours) || 0;
    if (loadHours >= 3) {
      factorBreakdown.nerRegional += 5;
      keyMarkers.push({ name: "Occupational Load Carrying (≥ 3 hrs/day)", level: "High", detail: "Agricultural and manual burden carrying in NER rural sectors increases joint axial compression." });
      recommendations.push("Distribute load burdens evenly with bilateral shoulder straps or mechanical carrying frames.");
    }

    // --- 4. Clinical Symptom Severity (Max 20) ---
    const painScale = parseInt(data.painScale) || 0;
    if (painScale >= 7) {
      factorBreakdown.clinicalSymptoms += 8;
      keyMarkers.push({ name: "Severe Joint Pain (Score " + painScale + "/10)", level: "Critical", detail: "Active subchondral bone strain or synovial inflammation." });
    } else if (painScale >= 4) {
      factorBreakdown.clinicalSymptoms += 5;
      keyMarkers.push({ name: "Moderate Joint Pain (Score " + painScale + "/10)", level: "Moderate", detail: "Intermittent mechanical discomfort during daily movement." });
    }

    if (data.morningStiffness === "over30") {
      factorBreakdown.clinicalSymptoms += 5;
      keyMarkers.push({ name: "Prolonged Morning Joint Stiffness (>30 mins)", level: "High", detail: "Classic clinical indicator of inflammatory articular cartilage breakdown." });
      recommendations.push("Perform gentle warm-up range-of-motion exercises before morning weight-bearing activity.");
    } else if (data.morningStiffness === "under30") {
      factorBreakdown.clinicalSymptoms += 3;
    }

    if (data.crepitus === "yes") {
      factorBreakdown.clinicalSymptoms += 4;
      keyMarkers.push({ name: "Joint Crepitus / Micro-Vibration", level: "Moderate", detail: "Palpable grinding caused by loss of smooth hyaline cartilage coating." });
    }

    if (data.jointSwelling === "yes") {
      factorBreakdown.clinicalSymptoms += 3;
    }

    // --- 5. Mobility Tests & Dual-Leg Hardware Wearable Metrics (Max 25) ---
    // Uses OAInferenceEngine (weighted logistic model) on the real, continuously
    // varying sensor features -- so this sub-score moves smoothly with actual
    // sensor data instead of jumping between a few fixed bucket values.
    let totalAsymmetry = 0, totalRomDeficit = 0, totalMedLat = 0, totalVelVar = 0, totalConfidence = 0;
    let minFlexionAngle = 180;
    let maxPlantarMedialRatio = 0;
    let maxPlantarLateralRatio = 0;
    let testCount = 0;

    Object.keys(mobilityResults).forEach(tId => {
      const res = mobilityResults[tId];
      if (res && !res.incomplete) {
        testCount++;
        totalAsymmetry += res.asymmetryIndex || 0;
        totalRomDeficit += (typeof res.romDeficit === 'number') ? res.romDeficit : 0;
        totalMedLat += (typeof res.medLatImbalance === 'number') ? res.medLatImbalance : 0;
        totalVelVar += (typeof res.velocityVariability === 'number') ? res.velocityVariability : 0;
        totalConfidence += (typeof res.confidence === 'number') ? res.confidence : 100;

        if (res.maxKneeFlexionL) minFlexionAngle = Math.min(minFlexionAngle, res.maxKneeFlexionL);
        if (res.maxKneeFlexionR) minFlexionAngle = Math.min(minFlexionAngle, res.maxKneeFlexionR);

        if (res.avgFsrL && res.avgFsrR) {
          // fsr[0] = Medial (1st Metatarsal), fsr[1] = Lateral (5th Metatarsal)
          const med = res.avgFsrL[0] + res.avgFsrR[0];
          const lat = res.avgFsrL[1] + res.avgFsrR[1];
          if (lat > 0) maxPlantarMedialRatio = Math.max(maxPlantarMedialRatio, med / lat);
          if (med > 0) maxPlantarLateralRatio = Math.max(maxPlantarLateralRatio, lat / med);
        }
      }
    });

    const mobilityDataAvailable = testCount > 0;
    let avgAsymmetry = 0;
    let mlInferenceResult = null;

    if (mobilityDataAvailable) {
      avgAsymmetry = totalAsymmetry / testCount;
      const avgRomDeficit = totalRomDeficit / testCount;
      const avgMedLat = totalMedLat / testCount;
      const avgVelVar = totalVelVar / testCount;
      const avgConfidence = totalConfidence / testCount;

      mlInferenceResult = this.mlEngine().infer({
        asymmetry: avgAsymmetry,
        romDeficit: avgRomDeficit,
        medLatImbalance: avgMedLat,
        velocityVariability: avgVelVar
      });

      factorBreakdown.mobilitySensors = this.mlEngine().bsiToRiskPoints(mlInferenceResult.biomechanicalStressIndex, 25);

      if (avgAsymmetry > 15) {
        keyMarkers.push({ name: `Severe Gait Asymmetry Index (${avgAsymmetry.toFixed(1)}%)`, level: "Critical", detail: "Marked load transfer to contralateral leg to compensate for affected knee pain." });
        recommendations.push("Physiotherapy gait-retraining and unilateral unloader knee brace prescription.");
      } else if (avgAsymmetry > 8) {
        keyMarkers.push({ name: `Moderate Gait Asymmetry (${avgAsymmetry.toFixed(1)}%)`, level: "Moderate", detail: "Unequal stance phase and weight distribution between legs." });
      }

      if (minFlexionAngle < 90 && minFlexionAngle !== 180) {
        keyMarkers.push({ name: `Restricted Knee Range of Motion (${minFlexionAngle}° Flexion)`, level: "High", detail: "Significant flexion deficit preventing normal squat and stair climbing." });
        recommendations.push("Targeted hamstring/quadriceps stretching and knee joint mobilization therapy.");
      }

      if (avgConfidence < 80) {
        keyMarkers.push({ name: `Reduced Wearable Sensor Confidence (${avgConfidence.toFixed(0)}%)`, level: "Moderate", detail: "One or more IMU/FSR channels reported sensor faults during testing -- verify wiring and re-test for a fully reliable score." });
      }
    } else {
      // No mobility tests / hardware data exist yet -- be explicit about
      // this instead of silently contributing a fixed placeholder value.
      factorBreakdown.mobilitySensors = 0;
      keyMarkers.push({ name: "Mobility & Hardware Sensor Assessment Pending", level: "Moderate", detail: "This score currently reflects intake-form factors only. Complete the 6 functional mobility tests with the ESP32 wearables connected for a full ML-driven biomechanical assessment." });
    }

    // Calculate Final Composite Risk Score
    compositeScore = Object.values(factorBreakdown).reduce((a, b) => a + b, 0);
    compositeScore = Math.min(100, Math.max(5, Math.round(compositeScore)));

    // Risk Category Classification
    let riskCategory = "Low Risk";
    let riskBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
    let urgentReferralNeeded = false;

    if (compositeScore >= 75) {
      riskCategory = "High / Advanced Risk";
      riskBadgeClass = "bg-rose-100 text-rose-800 border-rose-300";
      urgentReferralNeeded = true;
    } else if (compositeScore >= 50) {
      riskCategory = "Moderate OA Risk";
      riskBadgeClass = "bg-amber-100 text-amber-800 border-amber-300";
    } else if (compositeScore >= 30) {
      riskCategory = "Mild / Early OA Risk";
      riskBadgeClass = "bg-yellow-100 text-yellow-800 border-yellow-300";
    }

    // --- OA DISEASE SUBTYPE CLASSIFIER ---
    let diagnosedSubtype = "Undifferentiated / Primary Knee OA Risk";
    let subtypeDescription = "Early multi-factorial risk indicators observed without dominant single-compartment structural shift.";

    if (maxPlantarMedialRatio > 1.45 || (squatting === "frequent" && maxPlantarMedialRatio > 1.25)) {
      diagnosedSubtype = "Medial Compartment Knee Osteoarthritis";
      subtypeDescription = "Concentrated pressure over 1st metatarsal & medial heel FSRs, indicative of varus (bow-legged) alignment and inner joint space narrowing.";
      recommendations.unshift("Prescribe Lateral Wedge Shoe Insoles to offload medial compartment stress.");
    } else if (maxPlantarLateralRatio > 1.45) {
      diagnosedSubtype = "Lateral Compartment Knee Osteoarthritis";
      subtypeDescription = "Excess force over 5th metatarsal FSRs, indicative of valgus (knock-knee) alignment and outer joint compartment strain.";
      recommendations.unshift("Prescribe Medial Wedge Insoles to redistribute force toward center of foot.");
    } else if (painScale >= 5 && (squatting === "frequent" || terrainHours >= 3) && minFlexionAngle < 100) {
      diagnosedSubtype = "Patellofemoral Knee Osteoarthritis";
      subtypeDescription = "High retro-patellar friction exacerbated by deep squatting and hilly terrain walking, causing anterior knee discomfort.";
      recommendations.unshift("Patellar taping, VMO (Vastus Medialis Oblique) strengthening exercises, and avoidance of deep squats >90°.");
    } else if (avgAsymmetry > 14) {
      diagnosedSubtype = "Bilateral Knee OA with Severe Compensatory Asymmetry";
      subtypeDescription = "Significant biomechanical load shift to contralateral limb, predisposing secondary joint wear in opposite leg.";
      recommendations.unshift("Gait retraining using biofeedback sensors to balance left vs right stance weight distribution.");
    } else if (age < 50 && compositeScore >= 35 && (terrainHours >= 3 || squatting === "frequent")) {
      diagnosedSubtype = "Pre-Radiographic Early Biomechanical OA (NER Regional Risk)";
      subtypeDescription = "Early functional motion deficits and occupational slope stress detected prior to visible radiographic cartilage loss.";
      recommendations.unshift("Early lifestyle modification, ergonomic hill-walking techniques, and chondroprotective exercise protocol.");
    }

    // General Baseline Recommendations
    if (recommendations.length < 3) {
      recommendations.push("Perform quadriceps and calf strengthening exercises 3 times weekly.");
      recommendations.push("Schedule a follow-up biomechanical screening test in 3 to 6 months.");
    }

    return {
      score: compositeScore,
      riskCategory: riskCategory,
      riskBadgeClass: riskBadgeClass,
      urgentReferralNeeded: urgentReferralNeeded,
      diagnosedSubtype: diagnosedSubtype,
      subtypeDescription: subtypeDescription,
      bmi: parseFloat(bmi.toFixed(1)),
      bmiCategory: this.getBMICategory(bmi),
      gaitAsymmetryIndex: parseFloat(avgAsymmetry.toFixed(1)),
      factorBreakdown: factorBreakdown,
      keyMarkers: keyMarkers,
      recommendations: recommendations,
      mobilityDataAvailable: mobilityDataAvailable,
      biomechanicalStressIndex: mlInferenceResult ? mlInferenceResult.biomechanicalStressIndex : null,
      mlModelVersion: mlInferenceResult ? mlInferenceResult.modelVersion : this.mlEngine().MODEL_VERSION
    };
  }
};
