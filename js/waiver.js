/* ==========================================================================
   /js/waiver.js — WAIVER ELIGIBILITY CHECKER (FEATURE 2)
   Compares student's SSC GPA, HSC GPA, and Semester CGPA against the
   selected batch's waiverRules in departments.json.
   Updates eligible %, exact waiver amount in Taka, next higher waiver tier,
   and automatically syncs with the Fee Calculator in real time as you type!
   ========================================================================== */

window.SEUWaiver = (function () {
  let currentDept = null;
  let currentBatch = null;
  let currentEligiblePercent = 0;

  function init() {
    const sscInput = document.getElementById('waiver-ssc-input');
    const hscInput = document.getElementById('waiver-hsc-input');
    const cgpaInput = document.getElementById('waiver-cgpa-input');
    const applyBtn = document.getElementById('apply-waiver-btn');

    [sscInput, hscInput, cgpaInput].forEach(function (input) {
      if (input) {
        ['input', 'change'].forEach(function (evt) {
          input.addEventListener(evt, function () {
            // Evaluate and auto-sync to Fee Calculator immediately when user types GPA/CGPA
            evaluateWaiver(true);
          });
        });
      }
    });

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        if (window.SEUFee) {
          window.SEUFee.applyWaiverPercent(currentEligiblePercent, false);
          const feedbackEl = document.getElementById('apply-waiver-feedback');
          if (feedbackEl) {
            feedbackEl.textContent = '✓ Applied ' + currentEligiblePercent + '% waiver to the Semester & 4/5-Year Fee Calculator!';
            setTimeout(function () {
              feedbackEl.textContent = '';
            }, 3500);
          }
          const feeCard = document.getElementById('fee-result-card');
          if (feeCard) {
            feeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    }
  }

  function setBatch(deptObj, batchObj) {
    currentDept = deptObj;
    currentBatch = batchObj;

    const batchLabel = document.getElementById('waiver-batch-label');
    if (batchLabel && currentDept && currentBatch) {
      batchLabel.textContent = (currentDept.shortName || currentDept.name) + ' ' + currentBatch.name;
    }

    evaluateWaiver(false);
  }

  function refreshCalculations() {
    evaluateWaiver(false);
  }

  function doesRuleMatch(rule, ssc, hsc, cgpa) {
    if (rule.type === 'hsc_gpa' && !isNaN(hsc)) {
      return hsc >= rule.min;
    }
    if (rule.type === 'ssc_gpa' && !isNaN(ssc)) {
      return ssc >= rule.min;
    }
    if (rule.type === 'combined_gpa' && !isNaN(ssc) && !isNaN(hsc)) {
      return (ssc + hsc) >= rule.min;
    }
    if (rule.type === 'semester_cgpa' && !isNaN(cgpa)) {
      return cgpa >= rule.min;
    }
    return false;
  }

  function describeGapToRule(rule, ssc, hsc, cgpa) {
    if (rule.type === 'semester_cgpa') {
      const currentVal = isNaN(cgpa) ? 0 : cgpa;
      const diff = Math.max(0, rule.min - currentVal).toFixed(2);
      return 'Reach ' + rule.percent + '% waiver by achieving Semester TGPA ' + Number(rule.min).toFixed(2) +
        (isNaN(cgpa) ? ' (enter your Semester TGPA above).' : ' (+' + diff + ' more TGPA needed).');
    }
    if (rule.type === 'hsc_gpa') {
      const currentVal = isNaN(hsc) ? 0 : hsc;
      const diff = Math.max(0, rule.min - currentVal).toFixed(2);
      return 'Reach ' + rule.percent + '% waiver with HSC GPA ' + Number(rule.min).toFixed(2) +
        (isNaN(hsc) ? ' (enter your HSC GPA above).' : ' (+' + diff + ' more HSC GPA needed).');
    }
    if (rule.type === 'combined_gpa') {
      const currentVal = (!isNaN(ssc) && !isNaN(hsc)) ? (ssc + hsc) : 0;
      const diff = Math.max(0, rule.min - currentVal).toFixed(2);
      return 'Reach ' + rule.percent + '% waiver with combined SSC + HSC GPA ' + Number(rule.min).toFixed(2) +
        (currentVal === 0 ? ' (enter both SSC & HSC GPA).' : ' (+' + diff + ' combined GPA needed).');
    }
    return 'Next tier: ' + rule.percent + '% waiver (requires ' + rule.type + ' ≥ ' + rule.min + ').';
  }

  function evaluateWaiver(autoSyncToFeeCalc) {
    if (!currentBatch) return;

    const sscRaw = document.getElementById('waiver-ssc-input').value.trim();
    const hscRaw = document.getElementById('waiver-hsc-input').value.trim();
    const cgpaRaw = document.getElementById('waiver-cgpa-input').value.trim();
    const errorEl = document.getElementById('waiver-error-msg');

    const ssc = sscRaw === '' ? NaN : parseFloat(sscRaw);
    const hsc = hscRaw === '' ? NaN : parseFloat(hscRaw);
    const cgpa = cgpaRaw === '' ? NaN : parseFloat(cgpaRaw);

    let err = '';
    if (!isNaN(ssc) && (ssc < 0 || ssc > 5)) {
      err = 'SSC GPA must be between 0.00 and 5.00.';
    } else if (!isNaN(hsc) && (hsc < 0 || hsc > 5)) {
      err = 'HSC GPA must be between 0.00 and 5.00.';
    } else if (!isNaN(cgpa) && (cgpa < 0 || cgpa > 4)) {
      err = 'Semester TGPA / CGPA must be between 0.00 and 4.00.';
    }

    if (errorEl) {
      if (err) {
        errorEl.textContent = err;
        errorEl.hidden = false;
        return;
      } else {
        errorEl.hidden = true;
      }
    }

    const rules = (currentBatch.waiverRules || []).slice().sort(function (a, b) {
      return a.percent - b.percent;
    });

    const statusBadge = document.getElementById('waiver-status-badge');
    const pctEl = document.getElementById('waiver-eligible-pct');
    const takaEl = document.getElementById('waiver-eligible-taka');
    const matchedTextEl = document.getElementById('waiver-matched-rule-text');
    const nextTierTextEl = document.getElementById('waiver-next-tier-text');

    const anyEntered = !isNaN(ssc) || !isNaN(hsc) || !isNaN(cgpa);

    let bestRule = null;
    rules.forEach(function (rule) {
      if (doesRuleMatch(rule, ssc, hsc, cgpa)) {
        if (!bestRule || rule.percent >= bestRule.percent) {
          bestRule = rule;
        }
      }
    });

    currentEligiblePercent = bestRule ? bestRule.percent : 0;

    // If user actively edited GPA/CGPA inputs, immediately sync the eligible waiver % to the Fee Calculator!
    if (autoSyncToFeeCalc && window.SEUFee) {
      window.SEUFee.applyWaiverPercent(currentEligiblePercent, true);
    }

    const feeData = window.SEUFee ? window.SEUFee.getLatestCalculation() : { tuitionFee: 0, grossTotal: 0 };
    const baseForWaiver = (currentBatch.waiverBase === 'total') ? feeData.grossTotal : feeData.tuitionFee;
    const waiverTaka = Math.round(baseForWaiver * (currentEligiblePercent / 100));

    if (pctEl) pctEl.textContent = currentEligiblePercent + '%';
    if (takaEl && window.SEUFee) takaEl.textContent = window.SEUFee.formatTaka(waiverTaka);

    if (!anyEntered) {
      if (statusBadge) {
        statusBadge.className = 'waiver-status-badge';
        statusBadge.textContent = 'Waiting for GPA / CGPA input';
      }
      if (matchedTextEl) {
        matchedTextEl.textContent = 'Enter your SSC/HSC GPA or previous Semester TGPA on the left to check your eligibility.';
      }
      if (nextTierTextEl) {
        if (rules.length > 0) {
          nextTierTextEl.textContent = describeGapToRule(rules[0], ssc, hsc, cgpa);
        } else {
          nextTierTextEl.textContent = 'No waiver rules configured for this batch.';
        }
      }
      return;
    }

    if (bestRule) {
      if (statusBadge) {
        statusBadge.className = 'waiver-status-badge eligible';
        statusBadge.textContent = 'Eligible for ' + bestRule.percent + '% Waiver (Auto-Synced)';
      }
      if (matchedTextEl) {
        matchedTextEl.textContent = 'Matched Rule: ' + (bestRule.note || (bestRule.type + ' ≥ ' + bestRule.min));
      }

      const higherRules = rules.filter(function (r) {
        return r.percent > bestRule.percent;
      });
      if (nextTierTextEl) {
        if (higherRules.length > 0) {
          nextTierTextEl.textContent = describeGapToRule(higherRules[0], ssc, hsc, cgpa);
        } else {
          nextTierTextEl.textContent = 'Congratulations! You qualify for the highest waiver tier in this batch.';
        }
      }
    } else {
      if (statusBadge) {
        statusBadge.className = 'waiver-status-badge not-eligible';
        statusBadge.textContent = 'Not Eligible Yet (0%)';
      }
      if (matchedTextEl) {
        matchedTextEl.textContent = 'Not eligible for any waiver based on the entered data.';
      }
      if (nextTierTextEl) {
        if (rules.length > 0) {
          nextTierTextEl.textContent = describeGapToRule(rules[0], ssc, hsc, cgpa);
        } else {
          nextTierTextEl.textContent = 'No waiver tiers listed for this batch.';
        }
      }
    }
  }

  return {
    init: init,
    setBatch: setBatch,
    refreshCalculations: refreshCalculations
  };
})();
