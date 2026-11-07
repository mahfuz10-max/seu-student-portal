/* ==========================================================================
   /js/fee.js — SEMESTER FEE, INSTALLMENT & 4/5-YEAR COST CALCULATOR (FEATURE 1)
   Calculates in real time on every input/change event and every batch switch:
   1. Semester tuition, fixed semester transport/lab/activity fees, waiver
      deduction, net payable, and exact 40% / 30% / 30% installments.
   2. Full 4 or 5-Year Degree Total Cost (Tuition + One-Time Activity + Lab +
      Non-Credit/Vendor Fee = Approximate Total Cost) with and without
      the student's selected waiver percentage.
   ========================================================================== */

window.SEUFormatDate = function (dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) {
    return '';
  }
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (isNaN(year) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }
  return day + ' ' + months[monthIdx] + ' ' + year;
};

window.SEUFee = (function () {
  let currentDept = null;
  let currentBatch = null;
  let activeFeeMode = 'avg'; // 'avg' | 'zero' | 'admission'

  let latestCalculation = {
    credits: 12,
    perCreditFee: 5500,
    tuitionFee: 66000,
    semesterFee: 300,
    labFee: 5583,
    fixedFeeTotal: 5883,
    grossTotal: 71883,
    waiverPercent: 0,
    waiverBase: 'tuition',
    waiverAmount: 0,
    netPayable: 71883,
    installments: [28753, 21565, 21565],
    remainingAfter1st: 43130,
    remainingAfter2nd: 21565
  };

  function formatTaka(amount) {
    const rounded = Math.round(Number(amount) || 0);
    return '৳ ' + rounded.toLocaleString('en-IN');
  }

  function formatDate(dateStr) {
    return window.SEUFormatDate ? window.SEUFormatDate(dateStr) : dateStr;
  }

  function formatRuleLabel(rule) {
    if (rule.type === 'hsc_gpa') {
      return 'HSC GPA ≥ ' + Number(rule.min).toFixed(2) + ' → ' + rule.percent + '%';
    }
    if (rule.type === 'ssc_gpa') {
      return 'SSC GPA ≥ ' + Number(rule.min).toFixed(2) + ' → ' + rule.percent + '%';
    }
    if (rule.type === 'combined_gpa') {
      return 'SSC+HSC Combined GPA ≥ ' + Number(rule.min).toFixed(2) + ' → ' + rule.percent + '%';
    }
    if (rule.type === 'semester_cgpa') {
      return 'Semester TGPA ≥ ' + Number(rule.min).toFixed(2) + ' → ' + rule.percent + '%';
    }
    return rule.type + ' ≥ ' + rule.min + ' → ' + rule.percent + '%';
  }

  function init() {
    const perCreditInput = document.getElementById('fee-per-credit-input');
    const btnBatchRate = document.getElementById('btn-batch-rate');
    const btnLatestRate = document.getElementById('btn-latest-rate');
    const creditsInput = document.getElementById('fee-credits-input');
    const labInput = document.getElementById('fee-lab-input');
    const waiverSelect = document.getElementById('fee-waiver-select');
    const waiverManualGroup = document.getElementById('fee-waiver-manual-group');
    const waiverManualInput = document.getElementById('fee-waiver-manual-input');
    const resetLabBtn = document.getElementById('reset-lab-fee-btn');
    const printBtn = document.getElementById('print-fee-btn');
    const presetBtns = document.querySelectorAll('.credit-preset-btn');
    const feeModeBtns = document.querySelectorAll('.fee-mode-btn');

    if (perCreditInput) {
      ['input', 'change'].forEach(function (evt) {
        perCreditInput.addEventListener(evt, function () {
          syncRatePresetHighlight(perCreditInput.value);
          calculateAndRender();
        });
      });
    }

    if (btnBatchRate) {
      btnBatchRate.addEventListener('click', function () {
        if (currentBatch && perCreditInput) {
          perCreditInput.value = currentBatch.perCreditFee || 0;
          syncRatePresetHighlight(perCreditInput.value);
          calculateAndRender();
        }
      });
    }

    if (btnLatestRate) {
      btnLatestRate.addEventListener('click', function () {
        if (currentBatch && perCreditInput) {
          const latestRate = currentBatch.latestOfficialPerCreditFee || currentBatch.perCreditFee || 0;
          perCreditInput.value = latestRate;
          syncRatePresetHighlight(perCreditInput.value);
          calculateAndRender();
        }
      });
    }

    if (creditsInput) {
      ['input', 'change'].forEach(function (evt) {
        creditsInput.addEventListener(evt, function () {
          syncCreditPresetHighlight(creditsInput.value);
          calculateAndRender();
        });
      });
    }

    if (labInput) {
      ['input', 'change'].forEach(function (evt) {
        labInput.addEventListener(evt, function () {
          syncFeeModeButtonsFromValue(labInput.value);
          calculateAndRender();
        });
      });
    }

    if (waiverSelect) {
      ['input', 'change'].forEach(function (evt) {
        waiverSelect.addEventListener(evt, function () {
          if (waiverSelect.value === 'custom') {
            if (waiverManualGroup) waiverManualGroup.hidden = false;
          } else {
            if (waiverManualGroup) waiverManualGroup.hidden = true;
            if (waiverManualInput) waiverManualInput.value = waiverSelect.value;
          }
          calculateAndRender();
        });
      });
    }

    if (waiverManualInput) {
      ['input', 'change'].forEach(function (evt) {
        waiverManualInput.addEventListener(evt, function () {
          if (waiverSelect && waiverSelect.value !== 'custom') {
            waiverSelect.value = 'custom';
          }
          if (waiverManualGroup) waiverManualGroup.hidden = false;
          calculateAndRender();
        });
      });
    }

    if (resetLabBtn) {
      resetLabBtn.addEventListener('click', function () {
        applyFeeMode('avg');
      });
    }

    feeModeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const mode = btn.getAttribute('data-mode') || 'avg';
        applyFeeMode(mode);
      });
    });

    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const val = btn.getAttribute('data-credits');
        if (creditsInput) {
          creditsInput.value = val;
          syncCreditPresetHighlight(val);
          calculateAndRender();
        }
      });
    });

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  }

  function syncRatePresetHighlight(val) {
    if (!currentBatch) return;
    const num = Number(val);
    const batchRate = Number(currentBatch.perCreditFee || 0);
    const latestRate = Number(currentBatch.latestOfficialPerCreditFee || batchRate);

    const btnBatchRate = document.getElementById('btn-batch-rate');
    const btnLatestRate = document.getElementById('btn-latest-rate');

    if (btnBatchRate) {
      if (num === batchRate) btnBatchRate.classList.add('active');
      else btnBatchRate.classList.remove('active');
    }
    if (btnLatestRate) {
      if (num === latestRate && latestRate !== batchRate) btnLatestRate.classList.add('active');
      else if (num === latestRate && latestRate === batchRate) btnLatestRate.classList.add('active');
      else btnLatestRate.classList.remove('active');
    }
  }

  function syncFeeModeButtonsFromValue(val) {
    if (!currentBatch) return;
    const num = Number(val);
    const avgVal = Number(currentBatch.avgOneTimePerSem || currentBatch.labFee || 0);
    const admVal = Number(currentBatch.admissionFeeTotal || 23100) + avgVal;

    const feeModeBtns = document.querySelectorAll('.fee-mode-btn');
    feeModeBtns.forEach(function (b) {
      const m = b.getAttribute('data-mode');
      const isMatch =
        (m === 'zero' && num === 0) ||
        (m === 'avg' && num === avgVal) ||
        (m === 'admission' && num === admVal);
      if (isMatch) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  function applyFeeMode(mode) {
    activeFeeMode = mode;
    const labInput = document.getElementById('fee-lab-input');
    const feeModeBtns = document.querySelectorAll('.fee-mode-btn');

    feeModeBtns.forEach(function (b) {
      if (b.getAttribute('data-mode') === mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (!currentBatch || !labInput) return;

    if (mode === 'zero') {
      labInput.value = 0;
    } else if (mode === 'admission') {
      labInput.value = (currentBatch.admissionFeeTotal || 23100) + (currentBatch.avgOneTimePerSem || 0);
    } else {
      labInput.value = currentBatch.avgOneTimePerSem || currentBatch.labFee || 0;
    }

    calculateAndRender();
  }

  function syncCreditPresetHighlight(val) {
    const presetBtns = document.querySelectorAll('.credit-preset-btn');
    presetBtns.forEach(function (btn) {
      if (Number(btn.getAttribute('data-credits')) === Number(val)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function setBatch(deptObj, batchObj) {
    currentDept = deptObj;
    currentBatch = batchObj;

    if (!currentDept || !currentBatch) return;

    const perCr = currentBatch.perCreditFee || 0;
    const latestRate = currentBatch.latestOfficialPerCreditFee || perCr;

    const perCreditInput = document.getElementById('fee-per-credit-input');
    const btnBatchRate = document.getElementById('btn-batch-rate');
    const btnLatestRate = document.getElementById('btn-latest-rate');
    const rateBadge = document.getElementById('batch-credit-rate-badge');

    if (perCreditInput) {
      perCreditInput.value = perCr;
    }
    if (btnBatchRate) {
      btnBatchRate.textContent = 'Batch ' + currentBatch.id + ' Rate (' + formatTaka(perCr) + ')';
    }
    if (btnLatestRate) {
      btnLatestRate.textContent = 'Latest 2026 Rate (' + formatTaka(latestRate) + ')';
    }
    if (rateBadge) {
      rateBadge.textContent = currentBatch.name + ' • Semester ' + (currentBatch.currentSemesterNo || 1);
    }
    syncRatePresetHighlight(perCr);

    const creditsInput = document.getElementById('fee-credits-input');
    if (creditsInput && currentBatch.defaultSemCredits) {
      creditsInput.value = currentBatch.defaultSemCredits;
      syncCreditPresetHighlight(currentBatch.defaultSemCredits);
    }

    applyFeeMode(activeFeeMode);
    populateWaiverDropdown(currentBatch.waiverRules || []);
    calculateAndRender();
  }

  function populateWaiverDropdown(rules) {
    const waiverSelect = document.getElementById('fee-waiver-select');
    const waiverManualGroup = document.getElementById('fee-waiver-manual-group');
    const waiverManualInput = document.getElementById('fee-waiver-manual-input');
    if (!waiverSelect) return;

    const previousWaiverVal = waiverSelect.value === 'custom'
      ? (waiverManualInput ? waiverManualInput.value : '0')
      : (waiverSelect.value || '0');

    waiverSelect.innerHTML = '';

    const optZero = document.createElement('option');
    optZero.value = '0';
    optZero.textContent = '0% — No Waiver';
    waiverSelect.appendChild(optZero);

    rules.forEach(function (rule) {
      const opt = document.createElement('option');
      opt.value = String(rule.percent);
      opt.textContent = rule.percent + '% Waiver (' + formatRuleLabel(rule) + ')';
      waiverSelect.appendChild(opt);
    });

    const optCustom = document.createElement('option');
    optCustom.value = 'custom';
    optCustom.textContent = 'Custom / Manual Waiver %...';
    waiverSelect.appendChild(optCustom);

    let foundMatch = false;
    for (let i = 0; i < waiverSelect.options.length; i++) {
      if (waiverSelect.options[i].value === String(previousWaiverVal)) {
        waiverSelect.selectedIndex = i;
        foundMatch = true;
        break;
      }
    }

    if (foundMatch) {
      if (waiverManualGroup) waiverManualGroup.hidden = true;
    } else if (Number(previousWaiverVal) > 0) {
      waiverSelect.value = 'custom';
      if (waiverManualGroup) waiverManualGroup.hidden = false;
      if (waiverManualInput) waiverManualInput.value = previousWaiverVal;
    } else {
      waiverSelect.value = '0';
      if (waiverManualGroup) waiverManualGroup.hidden = true;
    }
  }

  function calculateAndRender(skipWaiverCallback) {
    if (!currentBatch) return;

    const perCreditInput = document.getElementById('fee-per-credit-input');
    const creditsInput = document.getElementById('fee-credits-input');
    const labInput = document.getElementById('fee-lab-input');
    const waiverSelect = document.getElementById('fee-waiver-select');
    const waiverManualInput = document.getElementById('fee-waiver-manual-input');
    const errorBox = document.getElementById('fee-error-msg');

    const rawPerCredit = parseFloat(perCreditInput ? perCreditInput.value : String(currentBatch.perCreditFee || 0));
    const rawCredits = parseFloat(creditsInput ? creditsInput.value : '0');
    const rawLab = parseFloat(labInput ? labInput.value : '0');

    let rawWaiver = 0;
    if (waiverSelect && waiverSelect.value === 'custom') {
      rawWaiver = parseFloat(waiverManualInput ? waiverManualInput.value : '0');
    } else if (waiverSelect) {
      rawWaiver = parseFloat(waiverSelect.value || '0');
    }

    let errorMsg = '';
    if (isNaN(rawPerCredit) || rawPerCredit <= 0) {
      errorMsg = 'Please enter a valid Per Credit Tuition Fee greater than 0.';
    } else if (isNaN(rawCredits) || rawCredits <= 0) {
      errorMsg = 'Tip: Enter credits greater than 0 (e.g., 12, 15, or 18) for your semester tuition.';
    } else if (rawCredits > 35) {
      errorMsg = 'Warning: Credits per semester usually do not exceed 35.';
    } else if (!isNaN(rawLab) && rawLab < 0) {
      errorMsg = 'Lab / Activity / Other fee cannot be negative.';
    } else if (!isNaN(rawWaiver) && (rawWaiver < 0 || rawWaiver > 100)) {
      errorMsg = 'Waiver percentage must be between 0% and 100%.';
    }

    if (errorBox) {
      if (errorMsg) {
        errorBox.textContent = errorMsg;
        errorBox.hidden = false;
      } else {
        errorBox.hidden = true;
      }
    }

    const safePerCredit = isNaN(rawPerCredit) ? 0 : Math.max(0, Math.round(rawPerCredit));
    const safeCredits = isNaN(rawCredits) ? 0 : Math.max(0, rawCredits);
    const safeLab = isNaN(rawLab) ? 0 : Math.max(0, Math.round(rawLab));
    const safeWaiver = isNaN(rawWaiver) ? 0 : Math.min(100, Math.max(0, rawWaiver));

    const yrs = currentBatch.durationYears || 4;
    const sems = currentBatch.totalSemesters || 12;
    const totalCr = currentBatch.totalCredits || 140;
    const actFee = currentBatch.activityFeeOneTime || 0;
    const labOneTime = currentBatch.labFeeOneTime || 0;
    const nonCrFee = currentBatch.nonCreditOrVendorFee || 0;
    const oneTimeSum = actFee + labOneTime + nonCrFee;
    const calType = currentBatch.calendarType || 'Tri-Semester';

    const degTuition = Math.round(totalCr * safePerCredit);
    const degApproxTotal = degTuition + oneTimeSum;
    const degAdmission = currentBatch.admissionFeeTotal || 23100;
    const degWaiverSavings = Math.round(degTuition * (safeWaiver / 100));
    const degNetAfterWaiver = Math.max(0, degApproxTotal - degWaiverSavings);
    const degWithAdmission = degNetAfterWaiver + degAdmission;

    setText('hero-stat-credit', formatTaka(safePerCredit));
    setText('hero-stat-sem', 'Sem ' + (currentBatch.currentSemesterNo || 1) + ' • ' + totalCr + ' Cr (' + yrs + 'Y)');
    setText('hero-stat-lab', formatTaka(degNetAfterWaiver));

    setText('fee-last-updated-text', formatDate(currentBatch.lastUpdated || '2026-11-06'));
    if (currentDept) {
      setText('info-dept-badge', currentDept.name + ' • ' + calType);
    }
    setText('info-batch-heading', currentBatch.name + ' (Running Semester ' + (currentBatch.currentSemesterNo || 1) + ') — Fee & ' + yrs + '-Year Summary');

    const baseText = (currentBatch.waiverBase === 'total')
      ? 'Waiver applied on: Total Gross Fee'
      : 'Waiver applied on: Tuition Fee Only';
    setText('info-waiver-base-tag', baseText);

    setText('info-per-credit', formatTaka(safePerCredit));
    setText('info-credits-duration-hint', totalCr + ' Credits • ' + yrs + ' Years (' + sems + ' Semesters)');
    setText('info-semester-fee', formatTaka(degTuition));
    setText('info-tuition-calc-hint', totalCr + ' credits × ' + formatTaka(safePerCredit));
    setText('info-lab-fee', formatTaka(oneTimeSum));

    let oneTimeBreakdownText = 'Activity: ' + formatTaka(actFee) + ' • Lab: ' + formatTaka(labOneTime);
    if (nonCrFee > 0) {
      oneTimeBreakdownText += ' • Extra: ' + formatTaka(nonCrFee);
    }
    setText('info-onetime-hint', oneTimeBreakdownText);

    setText('info-approx-label', safeWaiver > 0 ? ('Net ' + yrs + '-Yr Cost (' + safeWaiver + '% Waiver)') : ('Approx. Total Cost (' + yrs + ' Years)'));
    setText('info-approx-total', formatTaka(degNetAfterWaiver));

    const rulesListEl = document.getElementById('info-waiver-rules-list');
    if (rulesListEl) {
      rulesListEl.innerHTML = '';
      const rules = currentBatch.waiverRules || [];
      if (rules.length === 0) {
        rulesListEl.innerHTML = '<span class="waiver-rule-pill">No waiver tiers listed for this batch.</span>';
      } else {
        rules.forEach(function (rule) {
          const span = document.createElement('span');
          span.className = 'waiver-rule-pill';
          span.innerHTML = '<strong>' + rule.percent + '% Waiver:</strong> ' + formatRuleLabel(rule);
          rulesListEl.appendChild(span);
        });
      }
    }

    // 1. Semester Calculation (Unchanged core logic)
    const semesterFee = Number(currentBatch.semesterFee) || 300;
    const tuitionFee = Math.round(safeCredits * safePerCredit);
    const fixedFeeTotal = Math.round(semesterFee + safeLab);
    const grossTotal = tuitionFee + fixedFeeTotal;

    const waiverBase = (currentBatch.waiverBase === 'total') ? 'total' : 'tuition';
    const baseAmountForWaiver = (waiverBase === 'total') ? grossTotal : tuitionFee;
    const waiverAmount = Math.round(baseAmountForWaiver * (safeWaiver / 100));

    const netPayable = Math.max(0, grossTotal - waiverAmount);

    const inst1 = Math.round(netPayable * 0.40);
    const inst2 = Math.round(netPayable * 0.30);
    const inst3 = netPayable - inst1 - inst2;

    const remAfter1 = netPayable - inst1;
    const remAfter2 = netPayable - inst1 - inst2;

    latestCalculation = {
      credits: safeCredits,
      perCreditFee: safePerCredit,
      tuitionFee: tuitionFee,
      semesterFee: semesterFee,
      labFee: safeLab,
      fixedFeeTotal: fixedFeeTotal,
      grossTotal: grossTotal,
      waiverPercent: safeWaiver,
      waiverBase: waiverBase,
      waiverAmount: waiverAmount,
      netPayable: netPayable,
      installments: [inst1, inst2, inst3],
      remainingAfter1st: remAfter1,
      remainingAfter2nd: remAfter2
    };

    const subtitleEl = document.getElementById('fee-result-subtitle');
    if (subtitleEl && currentDept) {
      subtitleEl.textContent = (currentDept.shortName || currentDept.name) + ' • ' + currentBatch.name + ' • ' + safeCredits + ' Credits @ ' + formatTaka(safePerCredit) + '/cr';
    }

    setText('breakdown-tuition-formula', safeCredits + ' credits × ' + formatTaka(safePerCredit));
    setText('breakdown-tuition-val', formatTaka(tuitionFee));

    setText('breakdown-fixed-formula', 'Transport (' + formatTaka(semesterFee) + ') + Lab/Activity/Other (' + formatTaka(safeLab) + ')');
    setText('breakdown-fixed-val', formatTaka(fixedFeeTotal));

    setText('breakdown-total-val', formatTaka(grossTotal));
    setText('breakdown-waiver-pct', safeWaiver + '%');
    setText(
      'breakdown-waiver-note',
      waiverBase === 'total'
        ? 'Applied on total gross fee (' + formatTaka(grossTotal) + ')'
        : 'Applied on tuition fee (' + formatTaka(tuitionFee) + ')'
    );
    setText('breakdown-waiver-val', '- ' + formatTaka(waiverAmount));
    setText('breakdown-net-val', formatTaka(netPayable));

    const dates = currentBatch.installmentDates || ['', '', ''];
    setText('inst-1-due', dates[0] ? 'Due Date: ' + formatDate(dates[0]) : 'Due date not announced yet');
    setText('inst-2-due', dates[1] ? 'Due Date: ' + formatDate(dates[1]) : 'Due date not announced yet');
    setText('inst-3-due', dates[2] ? 'Due Date: ' + formatDate(dates[2]) : 'Due date not announced yet');

    setText('inst-1-amount', formatTaka(inst1));
    setText('inst-2-amount', formatTaka(inst2));
    setText('inst-3-amount', formatTaka(inst3));

    setText('rem-after-1', formatTaka(remAfter1));
    setText('rem-after-2', formatTaka(remAfter2));
    setText('inst-total-verify', formatTaka(netPayable));

    // 2. Full 4 / 5-Year Program Total Cost Breakdown DOM
    setText('degree-cost-heading', 'Total ' + yrs + '-Year Degree Cost Breakdown (' + (currentDept ? currentDept.shortName : '') + ' ' + currentBatch.name + ')');
    setText('deg-tuition-formula', totalCr + ' required credits × ' + formatTaka(safePerCredit));
    setText('deg-tuition-val', formatTaka(degTuition));
    setText('deg-activity-val', formatTaka(actFee));
    setText('deg-lab-val', labOneTime > 0 ? formatTaka(labOneTime) : 'N/A (৳ 0)');
    setText('deg-noncredit-val', nonCrFee > 0 ? (currentBatch.nonCreditLabel || formatTaka(nonCrFee)) : 'N/A (৳ 0)');
    setText('deg-approx-label', 'Approximate Total Cost (' + yrs + ' Years, Before Waiver)');
    setText('deg-approx-val', formatTaka(degApproxTotal));
    setText('deg-waiver-pct', safeWaiver + '%');
    setText('deg-waiver-val', '- ' + formatTaka(degWaiverSavings));
    setText('deg-net-val', formatTaka(degNetAfterWaiver));
    setText(
      'deg-with-admission-note',
      'Plus ' + formatTaka(degAdmission) + ' one-time Admission Fee = ' + formatTaka(degWithAdmission)
    );

    if (!skipWaiverCallback && window.SEUWaiver && typeof window.SEUWaiver.refreshCalculations === 'function') {
      window.SEUWaiver.refreshCalculations();
    }
    if (window.SEUTracker && typeof window.SEUTracker.refreshFromFeeCalc === 'function') {
      window.SEUTracker.refreshFromFeeCalc();
    }
  }

  function applyWaiverPercent(percent, silentSync) {
    const waiverSelect = document.getElementById('fee-waiver-select');
    const waiverManualGroup = document.getElementById('fee-waiver-manual-group');
    const waiverManualInput = document.getElementById('fee-waiver-manual-input');
    if (!waiverSelect) return;

    const strPct = String(percent);
    let matchedOption = false;

    for (let i = 0; i < waiverSelect.options.length; i++) {
      if (waiverSelect.options[i].value === strPct) {
        waiverSelect.selectedIndex = i;
        matchedOption = true;
        break;
      }
    }

    if (matchedOption) {
      if (waiverManualGroup) waiverManualGroup.hidden = true;
      if (waiverManualInput) waiverManualInput.value = strPct;
    } else {
      waiverSelect.value = 'custom';
      if (waiverManualGroup) waiverManualGroup.hidden = false;
      if (waiverManualInput) waiverManualInput.value = strPct;
    }

    calculateAndRender(Boolean(silentSync));
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getLatestCalculation() {
    return latestCalculation;
  }

  return {
    init: init,
    setBatch: setBatch,
    applyWaiverPercent: applyWaiverPercent,
    getLatestCalculation: getLatestCalculation,
    formatTaka: formatTaka,
    formatDate: formatDate
  };
})();
