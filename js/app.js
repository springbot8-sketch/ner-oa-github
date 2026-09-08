/**
 * Main Application Orchestrator & Controller Script
 * Coordinates Tab switching, Form Intake processing, Hardware Streaming,
 * 6 Mobility Tests, AI Diagnostics Engine, and Report Generator.
 */

document.addEventListener("DOMContentLoaded", function() {
  // Initialize Hardware & Mobility Modules
  OAHardwareStreamer.init();
  OAMobilityTests.init();

  // Tab Switcher
  window.switchAppTab = function(tabName) {
    const tabs = ["intake", "hardware", "mobility", "report", "dashboard", "esp32guide"];
    tabs.forEach(t => {
      const contentEl = document.getElementById(`tabContent-${t}`);
      const btnEl = document.getElementById(`tabBtn-${t}`);
      
      if (contentEl) {
        contentEl.classList.toggle("hidden", t !== tabName);
      }
      if (btnEl) {
        if (t === tabName) {
          btnEl.classList.add("text-teal-700", "border-teal-600", "font-bold");
          btnEl.classList.remove("text-slate-500", "border-transparent");
        } else {
          btnEl.classList.remove("text-teal-700", "border-teal-600", "font-bold");
          btnEl.classList.add("text-slate-500", "border-transparent");
        }
      }
    });

    if (tabName === "dashboard") {
      OADashboard.init();
    }
  };

  // Form Wizard Controller
  let currentStep = 1;
  window.goToWizardStep = function(step) {
    if (step < 1 || step > 3) return;
    for (let i = 1; i <= 3; i++) {
      const stepContent = document.getElementById(`wizardStep-${i}`);
      const stepIndicator = document.getElementById(`stepIndicator-${i}`);
      if (stepContent) stepContent.classList.toggle("hidden", i !== step);
      if (stepIndicator) {
        if (i === step) {
          stepIndicator.className = "w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-md";
        } else if (i < step) {
          stepIndicator.className = "w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs border border-teal-300";
        } else {
          stepIndicator.className = "w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs border border-slate-200";
        }
      }
    }
    currentStep = step;
  };

  // Live BMI Calculation
  const heightInput = document.getElementById("inputHeight");
  const weightInput = document.getElementById("inputWeight");
  const bmiDisplay = document.getElementById("liveBMIDisplay");

  function updateLiveBMI() {
    if (!heightInput || !weightInput || !bmiDisplay) return;
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);

    if (h > 0 && w > 0) {
      const bmi = w / ((h / 100) * (h / 100));
      const cat = OAAIEngine.getBMICategory(bmi);
      bmiDisplay.innerHTML = `<span class="font-bold text-slate-800">${bmi.toFixed(1)} kg/m²</span> <span class="text-xs text-teal-700 font-semibold">(${cat})</span>`;
    } else {
      bmiDisplay.textContent = "--";
    }
  }

  if (heightInput) heightInput.addEventListener("input", updateLiveBMI);
  if (weightInput) weightInput.addEventListener("input", updateLiveBMI);

  // Pain Slider Label Update
  const painSlider = document.getElementById("inputPainScale");
  const painValueDisplay = document.getElementById("painScaleValueDisplay");
  if (painSlider && painValueDisplay) {
    painSlider.addEventListener("input", function() {
      painValueDisplay.textContent = this.value + " / 10";
    });
  }

  // Load Sample High-Risk Patient Button
  const loadSampleBtn = document.getElementById("btnLoadSamplePatient");
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", function() {
      document.getElementById("inputName").value = "Priya Sharma";
      document.getElementById("inputAge").value = "56";
      document.getElementById("inputGender").value = "female";
      document.getElementById("inputState").value = "Meghalaya";
      document.getElementById("inputDistrict").value = "East Khasi Hills";
      document.getElementById("inputHeight").value = "158";
      document.getElementById("inputWeight").value = "74";
      document.getElementById("inputHillyHours").value = "4";
      document.getElementById("inputSquatting").value = "frequent";
      document.getElementById("inputLoadHours").value = "2.5";
      document.getElementById("inputTargetJoint").value = "Knee";
      document.getElementById("inputPainScale").value = "7";
      if (painValueDisplay) painValueDisplay.textContent = "7 / 10";
      document.getElementById("inputStiffness").value = "over30";
      document.getElementById("inputCrepitus").value = "yes";
      document.getElementById("inputSwelling").value = "yes";
      document.getElementById("inputInjury").value = "yes";
      document.getElementById("inputFamilyHistory").value = "yes";

      updateLiveBMI();
      alert("Sample high-risk patient data from East Khasi Hills, Meghalaya loaded successfully!");
    });
  }

  // Handle Intake Form Submit
  const patientForm = document.getElementById("patientIntakeForm");
  if (patientForm) {
    patientForm.addEventListener("submit", function(e) {
      e.preventDefault();

      const formData = {
        name: document.getElementById("inputName").value.trim() || "Anonymous Patient",
        age: document.getElementById("inputAge").value,
        gender: document.getElementById("inputGender").value,
        state: document.getElementById("inputState").value,
        district: document.getElementById("inputDistrict").value.trim(),
        height: document.getElementById("inputHeight").value,
        weight: document.getElementById("inputWeight").value,
        hillyTerrainHours: document.getElementById("inputHillyHours").value,
        squattingFrequency: document.getElementById("inputSquatting").value,
        loadCarryingHours: document.getElementById("inputLoadHours").value,
        targetJoint: document.getElementById("inputTargetJoint").value,
        painScale: document.getElementById("inputPainScale").value,
        morningStiffness: document.getElementById("inputStiffness").value,
        crepitus: document.getElementById("inputCrepitus").value,
        jointSwelling: document.getElementById("inputSwelling").value,
        pastInjury: document.getElementById("inputInjury").value,
        familyHistory: document.getElementById("inputFamilyHistory").value
      };

      try {
        // Run AI Evaluation with available mobility test results
        const assessment = OAAIEngine.evaluateRisk(formData, OAMobilityTests.results);

        const record = {
          id: "NER-OA-" + Math.floor(100000 + Math.random() * 900000),
          timestamp: Date.now(),
          input: formData,
          assessment: assessment,
          mobilityResults: OAMobilityTests.results
        };

        // Keep this as the "active" patient so the report can be refreshed
        // later once hardware/mobility tests are completed.
        window.OACurrentPatientRecord = record;

        // Save to Dashboard Registry
        OADashboard.saveRecord(record);

        // Render Report immediately (will reflect whatever mobility data
        // exists right now -- likely none yet, refreshed later via
        // window.regenerateReport()).
        OAReportGenerator.renderReport(record);

        // Switch to Hardware tab so hardware/mobility tests can be performed
        switchAppTab("hardware");
        alert("Patient intake saved successfully! Please perform Dual-Leg Wearable Hardware & Mobility Tests, then open the Clinical Report tab and click \"Refresh Report\" to include those results.");
      } catch (err) {
        console.error("Failed to generate assessment/report:", err);
        alert("Something went wrong generating the report: " + err.message + "\nPlease check that all required intake fields are filled in and try again.");
      }
    });
  }
});

/**
 * Re-runs the AI risk assessment for the currently active patient using
 * whatever mobility-test results exist right now, and re-renders the
 * Clinical Report tab. Call this any time mobility/hardware data changes
 * so the report never goes stale. Exposed on window so the Report tab's
 * "Refresh Report" button and mobility-tests.js can both call it.
 */
window.regenerateReport = function() {
  const current = window.OACurrentPatientRecord;
  if (!current) {
    alert("No patient has been entered yet. Please complete the Patient Intake form first.");
    return;
  }
  try {
    const assessment = OAAIEngine.evaluateRisk(current.input, OAMobilityTests.results);
    current.assessment = assessment;
    current.mobilityResults = OAMobilityTests.results;

    OADashboard.saveRecord(current);
    OAReportGenerator.renderReport(current);

    if (typeof switchAppTab === "function") switchAppTab("report");
  } catch (err) {
    console.error("Failed to refresh report:", err);
    alert("Could not refresh the report: " + err.message);
  }
};
