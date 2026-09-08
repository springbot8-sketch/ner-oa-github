/**
 * Clinical Report Generator & PDF Export Module
 * Generates official medical screening reports with Dual-Leg Hardware Wearable Metrics,
 * 6 Mobility Tests, AI OA Subtype Diagnosis, and NER Regional Context.
 */

window.OAReportGenerator = {
  /**
   * Escapes HTML special characters so patient-entered text (name,
   * district, etc.) can never be interpreted as HTML/JS when inserted via
   * innerHTML. Without this, a patient name like <img src=x onerror=...>
   * would execute as a stored XSS payload every time the report renders.
   */
  escapeHtml: function(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Renders one row of the AI explainability breakdown: a labeled
   * progress bar showing how many of the category's max points were
   * contributed to the composite risk score.
   */
  renderFactorBar: function(label, value, max) {
    const esc = this.escapeHtml;
    const safeValue = typeof value === 'number' ? value : 0;
    const pct = Math.max(0, Math.min(100, (safeValue / max) * 100));
    const colorClass = pct >= 70 ? 'bg-rose-500' : pct >= 40 ? 'bg-amber-500' : 'bg-teal-500';
    return `
      <div>
        <div class="flex justify-between text-[11px] text-slate-600 mb-1">
          <span>${esc(label)}</span>
          <span class="font-semibold">${esc(Math.round(safeValue * 10) / 10)} / ${esc(max)}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="${colorClass} h-full" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  },

  /**
   * Renders the patient report into the report DOM container
   * @param {Object} patientRecord - Combined patient data, mobility tests, and AI evaluation
   */
  renderReport: function(patientRecord) {
    const reportContainer = document.getElementById("clinicalReportContainer");
    if (!reportContainer) return;

    if (!patientRecord || !patientRecord.input || !patientRecord.assessment) {
      reportContainer.innerHTML = `
        <div class="text-center py-12 text-slate-400 text-sm">
          No report data available yet. Please complete the Patient Intake form first.
        </div>`;
      return;
    }

    const esc = this.escapeHtml;
    const data = patientRecord.input;
    // Renamed from "eval" -- shadowing the built-in global eval() function
    // is bad practice and gets flagged by strict-mode/CSP tooling.
    const assessmentData = patientRecord.assessment;
    const mobility = patientRecord.mobilityResults || {};

    const reportDate = new Date(patientRecord.timestamp || Date.now()).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const reportId = esc(patientRecord.id || "NER-OA-" + Math.floor(100000 + Math.random() * 900000));

    const keyMarkers = assessmentData.keyMarkers || [];
    const recommendations = assessmentData.recommendations || [];

    const markersHtml = keyMarkers.length > 0 ? keyMarkers.map(m => `
      <div class="p-3 bg-slate-50 border-l-4 ${m.level === 'Critical' ? 'border-rose-500 bg-rose-50/50' : m.level === 'High' ? 'border-amber-500 bg-amber-50/50' : 'border-teal-500'} rounded-r text-sm">
        <div class="flex justify-between items-center font-semibold text-slate-800">
          <span>${esc(m.name)}</span>
          <span class="px-2 py-0.5 text-xs font-bold rounded ${m.level === 'Critical' ? 'bg-rose-200 text-rose-800' : m.level === 'High' ? 'bg-amber-200 text-amber-900' : 'bg-teal-200 text-teal-900'}">${esc(m.level)} Risk</span>
        </div>
        <p class="text-slate-600 text-xs mt-1">${esc(m.detail)}</p>
      </div>
    `).join('') : '<p class="text-slate-500 text-sm italic">No critical clinical markers detected.</p>';

    const recsHtml = recommendations.map((rec, idx) => `
      <li class="flex items-start text-sm text-slate-700">
        <span class="inline-flex items-center justify-center w-5 h-5 mr-2 text-xs font-bold text-teal-700 bg-teal-100 rounded-full shrink-0 mt-0.5">${idx + 1}</span>
        <span>${esc(rec)}</span>
      </li>
    `).join('');

    // Generate 6 Mobility Tests Summary Rows
    const mobilityTestNames = {
      sit_to_stand: "30s Sit-to-Stand Test",
      squats: "Deep Squat Mobility",
      gait: "Timed Gait & Stride",
      balance: "Single Leg Stance",
      stairs: "Stair Stepping Test",
      rom: "Knee Range of Motion"
    };

    const mobilityRowsHtml = Object.keys(mobilityTestNames).map(key => {
      const res = mobility[key];
      if (res && !res.incomplete) {
        return `
          <tr class="border-b border-slate-100">
            <td class="py-2.5 px-3 font-medium text-slate-800 text-xs">${esc(mobilityTestNames[key])}</td>
            <td class="py-2.5 px-3 text-xs text-slate-600">${esc(res.maxKneeFlexionL)}° / ${esc(res.maxKneeFlexionR)}°</td>
            <td class="py-2.5 px-3 text-xs text-slate-600">${esc(res.asymmetryIndex)}%</td>
            <td class="py-2.5 px-3 font-bold text-xs ${res.score >= 86 ? 'text-emerald-700' : res.score >= 78 ? 'text-amber-700' : 'text-rose-700'}">${esc(res.score)}/100</td>
            <td class="py-2.5 px-3 text-xs text-slate-500">${esc(res.rating)}</td>
          </tr>
        `;
      } else {
        return `
          <tr class="border-b border-slate-100 text-slate-400">
            <td class="py-2 px-3 text-xs">${esc(mobilityTestNames[key])}</td>
            <td class="py-2 px-3 text-xs" colspan="4">Test Pending / Not Performed</td>
          </tr>
        `;
      }
    }).join('');

    reportContainer.innerHTML = `
      <div id="pdfPrintableArea" class="bg-white p-8 md:p-10 border border-slate-200 shadow-xl rounded-2xl max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-black text-2xl shadow-md">NER</div>
              <div>
                <h1 class="text-xl font-bold text-slate-900 leading-tight">AI-Assisted Osteoarthritis Early Detection Portal</h1>
                <p class="text-xs text-teal-700 font-semibold uppercase tracking-wider">North Eastern Region (NER) Healthcare & Wearable Screening Network</p>
              </div>
            </div>
          </div>
          <div class="text-left sm:text-right text-xs text-slate-500 border-l sm:border-l-0 pl-3 sm:pl-0 border-teal-500">
            <p><span class="font-bold text-slate-700">Report ID:</span> <span class="font-mono text-teal-800 font-semibold">${reportId}</span></p>
            <p><span class="font-bold text-slate-700">Date:</span> ${reportDate}</p>
            <p><span class="font-bold text-slate-700">Hardware:</span> ESP32 Dual-Leg (2 boards, 4 MPUs + 4 FSRs)</p>
          </div>
        </div>

        <!-- Emergency / Urgent Alert if severe -->
        ${assessmentData.urgentReferralNeeded ? `
          <div class="mt-6 p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3">
            <svg class="w-6 h-6 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <div>
              <h4 class="text-sm font-bold text-rose-900">Urgent Orthopedic Clinical Evaluation Recommended</h4>
              <p class="text-xs text-rose-700 mt-0.5">Composite risk index and hardware gait asymmetry exceed critical clinical thresholds. Immediate orthopedic consultation and weight-bearing radiograph are strongly advised.</p>
            </div>
          </div>
        ` : ''}

        <!-- Patient Demographics Summary Grid -->
        <div class="mt-6 bg-slate-50 p-5 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span class="text-slate-400 uppercase font-semibold block text-[10px]">Patient Name</span>
            <span class="font-bold text-slate-800 text-sm">${esc(data.name) || "Anonymous Patient"}</span>
          </div>
          <div>
            <span class="text-slate-400 uppercase font-semibold block text-[10px]">Age / Gender</span>
            <span class="font-bold text-slate-800 text-sm">${esc(data.age)} yrs / ${data.gender === 'female' ? 'Female' : data.gender === 'male' ? 'Male' : 'Other'}</span>
          </div>
          <div>
            <span class="text-slate-400 uppercase font-semibold block text-[10px]">NER Location</span>
            <span class="font-bold text-slate-800 text-sm">${data.district ? esc(data.district) + ', ' : ''}${esc(data.state) || 'Assam'}</span>
          </div>
          <div>
            <span class="text-slate-400 uppercase font-semibold block text-[10px]">BMI / Weight</span>
            <span class="font-bold text-slate-800 text-sm">${esc(assessmentData.bmi)} kg/m² <span class="text-[11px] text-slate-500 font-normal">(${data.weight || '--'} kg)</span></span>
          </div>
        </div>

        <!-- AI Risk Summary Score & Diagnosed OA Subtype Banner -->
        <div class="mt-6 p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6" style="background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full border ${assessmentData.riskBadgeClass}">
                ${esc(assessmentData.riskCategory)}
              </span>
              <span class="text-xs text-slate-500">Gait Asymmetry: <strong class="text-slate-800">${esc(assessmentData.gaitAsymmetryIndex)}%</strong></span>
            </div>
            
            <div class="mt-3">
              <span class="text-[10px] text-teal-700 font-bold uppercase tracking-wider block">Diagnosed OA Disease Subtype</span>
              <h3 class="text-lg font-black text-slate-900 leading-snug">${esc(assessmentData.diagnosedSubtype)}</h3>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">${esc(assessmentData.subtypeDescription)}</p>
            </div>
          </div>

          <!-- Score Gauge Circle -->
          <div class="relative w-28 h-28 shrink-0 flex items-center justify-center bg-white rounded-full shadow-inner border border-slate-200">
            <div class="text-center">
              <span class="text-3xl font-black text-slate-900 leading-none">${esc(assessmentData.score)}</span>
              <span class="text-[10px] text-slate-400 block mt-0.5 font-bold uppercase">Risk Score / 100</span>
            </div>
          </div>
        </div>

        <!-- 6 Functional Physical Mobility Tests Performance Table -->
        <div class="mt-8">
          <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Dual-Leg Wearable Sensor & Mobility Test Summary
          </h3>
          <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table class="min-w-full text-left bg-white">
              <thead class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th class="py-2.5 px-3">Test Description</th>
                  <th class="py-2.5 px-3">Left / Right Knee Flexion</th>
                  <th class="py-2.5 px-3">Load Asymmetry</th>
                  <th class="py-2.5 px-3">Test Score</th>
                  <th class="py-2.5 px-3">Clinical Status</th>
                </tr>
              </thead>
              <tbody>
                ${mobilityRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- AI/ML Explainability Panel -->
        <div class="mt-8">
          <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AI Risk Model Explainability
          </h3>
          <p class="text-[11px] text-slate-500 mt-1">${esc(assessmentData.mlModelVersion || 'OA-Net inference engine')} &mdash; composite score breakdown by category.</p>
          <div class="mt-3 space-y-2.5">
            ${this.renderFactorBar('Demographics (Age/Gender)', assessmentData.factorBreakdown.demographics, 15)}
            ${this.renderFactorBar('Physical Metrics / BMI', assessmentData.factorBreakdown.physicalBmi, 20)}
            ${this.renderFactorBar('NER Regional & Occupational', assessmentData.factorBreakdown.nerRegional, 20)}
            ${this.renderFactorBar('Clinical Symptoms', assessmentData.factorBreakdown.clinicalSymptoms, 20)}
            ${this.renderFactorBar('Mobility Sensors (ML Inference)', assessmentData.factorBreakdown.mobilitySensors, 25)}
          </div>
          ${assessmentData.mobilityDataAvailable ? `
            <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              Biomechanical Stress Index (from wearable sensor data): <strong class="text-slate-800">${esc(assessmentData.biomechanicalStressIndex)}</strong>/100 &mdash;
              computed from real-time gait asymmetry, range-of-motion deficit, plantar medial/lateral load imbalance, and movement-velocity variability captured during the mobility tests.
            </div>
          ` : `
            <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              Mobility sensor data not yet included &mdash; complete the 6 functional mobility tests with the ESP32 wearables connected, then click "Refresh Report" for the full ML-driven score.
            </div>
          `}
        </div>

        <!-- Key Biomechanical Markers Grid -->
        <div class="mt-8">
          <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Identified Risk Markers</h3>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            ${markersHtml}
          </div>
        </div>

        <!-- Actionable Clinical & Physiotherapy Recommendations -->
        <div class="mt-8 p-5 bg-teal-50/60 rounded-xl border border-teal-200">
          <h3 class="text-sm font-bold text-teal-900 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Personalized Clinical & Physiotherapy Plan
          </h3>
          <ul class="mt-3 space-y-2">
            ${recsHtml}
          </ul>
        </div>

        <!-- Signatures & Verification -->
        <div class="mt-10 pt-6 border-t border-slate-200 flex items-end justify-between text-xs text-slate-500">
          <div>
            <p class="font-semibold text-slate-700">Screening Center: NER Tele-Health & Orthopedic Cell</p>
            <p>Technician Signature: ______________________</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-teal-800">Verified by AI-Diagnostic Engine v3.2</p>
            <p class="text-[10px]">ICMR & MDoNER Screening Protocol Guidelines</p>
          </div>
        </div>
      </div>
    `;
  },

  exportPDF: function() {
    const element = document.getElementById("pdfPrintableArea");
    if (!element) {
      alert("No report content found to export!");
      return;
    }

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     'OA_Risk_Screening_Report_NER.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  }
};
