/**
 * Clinician Dashboard & Registry Module
 * Manages patient screening records, state-wise NER distribution, and CSV exporting.
 */

window.OADashboard = {
  init: function() {
    this.renderDashboard();
  },

  getRecords: function() {
    try {
      const recs = localStorage.getItem("ner_oa_patient_records");
      return recs ? JSON.parse(recs) : this.getSeedData();
    } catch (e) {
      return this.getSeedData();
    }
  },

  saveRecord: function(record) {
    const records = this.getRecords();
    records.unshift(record);
    localStorage.setItem("ner_oa_patient_records", JSON.stringify(records));
  },

  getSeedData: function() {
    return [
      {
        id: "NER-OA-904128",
        timestamp: Date.now() - 86400000 * 2,
        input: {
          name: "Biren Gogoi",
          age: 62,
          gender: "male",
          state: "Assam",
          district: "Kamrup Metropolitan",
          height: 165,
          weight: 78,
          painScale: 6,
          squattingFrequency: "frequent"
        },
        assessment: {
          score: 68,
          riskCategory: "Moderate OA Risk",
          riskBadgeClass: "bg-amber-100 text-amber-800 border-amber-300",
          diagnosedSubtype: "Medial Compartment Knee Osteoarthritis",
          subtypeDescription: "Concentrated pressure over 1st metatarsal & medial heel FSRs.",
          bmi: 28.7,
          bmiCategory: "Class I Obesity",
          gaitAsymmetryIndex: 11.4
        }
      },
      {
        id: "NER-OA-741290",
        timestamp: Date.now() - 86400000 * 5,
        input: {
          name: "Lalrinsangi",
          age: 48,
          gender: "female",
          state: "Mizoram",
          district: "Aizawl",
          height: 154,
          weight: 69,
          painScale: 8,
          squattingFrequency: "frequent"
        },
        assessment: {
          score: 82,
          riskCategory: "High / Advanced Risk",
          riskBadgeClass: "bg-rose-100 text-rose-800 border-rose-300",
          diagnosedSubtype: "Patellofemoral Knee Osteoarthritis",
          subtypeDescription: "High retro-patellar friction exacerbated by deep squatting and steep hill climbing.",
          bmi: 29.1,
          bmiCategory: "Class I Obesity",
          gaitAsymmetryIndex: 16.8
        }
      },
      {
        id: "NER-OA-319082",
        timestamp: Date.now() - 86400000 * 8,
        input: {
          name: "Tashi Tsering",
          age: 39,
          gender: "male",
          state: "Arunachal Pradesh",
          district: "Tawang",
          height: 170,
          weight: 65,
          painScale: 3,
          squattingFrequency: "occasional"
        },
        assessment: {
          score: 34,
          riskCategory: "Mild / Early OA Risk",
          riskBadgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
          diagnosedSubtype: "Pre-Radiographic Early Biomechanical OA (NER Regional Risk)",
          subtypeDescription: "Early functional motion deficits detected prior to visible cartilage loss.",
          bmi: 22.5,
          bmiCategory: "Normal Weight",
          gaitAsymmetryIndex: 4.8
        }
      }
    ];
  },

  renderDashboard: function() {
    const tableBody = document.getElementById("dashboardTableBody");
    const totalEl = document.getElementById("statTotalPatients");
    const highRiskEl = document.getElementById("statHighRiskCount");
    const avgScoreEl = document.getElementById("statAvgScore");

    const records = this.getRecords();

    if (totalEl) totalEl.textContent = records.length;
    
    const highRiskCount = records.filter(r => r.assessment && r.assessment.score >= 70).length;
    if (highRiskEl) highRiskEl.textContent = highRiskCount;

    const avgScore = records.length > 0 ? (records.reduce((a, b) => a + (b.assessment ? b.assessment.score : 0), 0) / records.length).toFixed(1) : 0;
    if (avgScoreEl) avgScoreEl.textContent = avgScore;

    if (tableBody) {
      if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-sm">No patient screening records stored yet.</td></tr>`;
        return;
      }

      tableBody.innerHTML = records.map(r => {
        const esc = OAReportGenerator.escapeHtml;
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="py-3 px-4 font-mono font-bold text-teal-800">${esc(r.id)}</td>
          <td class="py-3 px-4 font-bold text-slate-900">${r.input ? esc(r.input.name) : 'Unknown'}</td>
          <td class="py-3 px-4">${r.input ? esc(r.input.age) : '--'} yrs / ${r.input ? esc(r.input.gender) : '--'}</td>
          <td class="py-3 px-4">${r.input ? esc(r.input.state) : 'Assam'}</td>
          <td class="py-3 px-4 font-semibold text-slate-700">${r.assessment ? esc(r.assessment.diagnosedSubtype) : 'Primary Knee OA'}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 font-bold rounded-full border ${r.assessment ? r.assessment.riskBadgeClass : 'bg-slate-100'}">
              ${r.assessment ? esc(r.assessment.score) + '% (' + esc(r.assessment.riskCategory) + ')' : '--'}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="OADashboard.viewReport('${esc(r.id)}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded border border-teal-200 transition">
              View Report
            </button>
          </td>
        </tr>
      `;
      }).join('');
    }
  },

  viewReport: function(recordId) {
    const records = this.getRecords();
    const target = records.find(r => r.id === recordId);
    if (target) {
      OAReportGenerator.renderReport(target);
      switchAppTab('report');
    }
  },

  /**
   * Escapes a single CSV field: doubles internal quotes, and neutralizes
   * "CSV/formula injection" -- if a field starts with =, +, -, or @,
   * Excel/Sheets can interpret it as a formula when the file is opened.
   * Prefixing with a single quote character forces it to be read as text.
   */
  csvSafeField: function(value) {
    let str = String(value === null || value === undefined ? '' : value);
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }
    return str.replace(/"/g, '""');
  },

  exportCSV: function() {
    const records = this.getRecords();
    if (records.length === 0) {
      alert("No data available to export!");
      return;
    }

    const f = this.csvSafeField;
    let csv = "Report ID,Patient Name,Age,Gender,State,District,BMI,Pain Scale,OA Risk Score,Diagnosed Subtype,Gait Asymmetry %\n";
    records.forEach(r => {
      const inp = r.input || {};
      const assessmentData = r.assessment || {};
      csv += `"${f(r.id)}","${f(inp.name || '')}",${f(inp.age || '')},"${f(inp.gender || '')}","${f(inp.state || '')}","${f(inp.district || '')}",${f(assessmentData.bmi || '')},${f(inp.painScale || '')},${f(assessmentData.score || '')},"${f(assessmentData.diagnosedSubtype || '')}",${f(assessmentData.gaitAsymmetryIndex || '')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `NER_OA_Patient_Registry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
