/* ==========================================================================
   /js/tracker.js — PAYMENT TRACKER & DUE DATE COUNTDOWN (FEATURES 3 & 4)
   - Saves installment paid status, payment date, and note (e.g. bKash TrxID)
     in localStorage separately for each department + batch.
   - Marks overdue installments in red if due date has passed and not paid.
   - Formats due dates as "5 Nov 2026" and shows the data-file due date hint.
   ========================================================================== */

window.SEUTracker = (function () {
  let currentDept = null;
  let currentBatch = null;

  function getDefaultTrackerState() {
    return {
      installments: [
        { paid: false, paidDate: '', note: '' },
        { paid: false, paidDate: '', note: '' },
        { paid: false, paidDate: '', note: '' }
      ]
    };
  }

  function formatDate(dateStr) {
    return window.SEUFormatDate ? window.SEUFormatDate(dateStr) : dateStr;
  }

  function getStorageKey() {
    if (!currentDept || !currentBatch) return 'seu_tracker_default';
    return 'seu_tracker_' + currentDept.id + '_' + currentBatch.id;
  }

  function loadTrackerState() {
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.installments) && parsed.installments.length === 3) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
    return getDefaultTrackerState();
  }

  function saveTrackerState(state) {
    const key = getStorageKey();
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // Ignore storage errors
    }
  }

  function getDaysUntilDue(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) {
      return null;
    }
    const parts = dateStr.trim().split('-');
    if (parts.length !== 3) return null;

    const dueDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(dueDate.getTime())) return null;

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dueDate.getTime() - todayMidnight.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function init() {
    const resetBtn = document.getElementById('reset-tracker-btn');
    const modal = document.getElementById('reset-confirm-modal');
    const cancelBtn = document.getElementById('cancel-reset-tracker-btn');
    const confirmBtn = document.getElementById('confirm-reset-tracker-btn');

    if (resetBtn && modal) {
      resetBtn.addEventListener('click', function () {
        const nameEl = document.getElementById('reset-modal-batch-name');
        if (nameEl && currentDept && currentBatch) {
          nameEl.textContent = (currentDept.shortName || currentDept.name) + ' — ' + currentBatch.name;
        }
        modal.hidden = false;
      });
    }

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', function () {
        modal.hidden = true;
      });
    }

    if (confirmBtn && modal) {
      confirmBtn.addEventListener('click', function () {
        const freshState = getDefaultTrackerState();
        saveTrackerState(freshState);
        modal.hidden = true;
        renderTrackerAndCountdown();
      });
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          modal.hidden = true;
        }
      });
    }
  }

  function setBatch(deptObj, batchObj) {
    currentDept = deptObj;
    currentBatch = batchObj;

    const batchLabel = document.getElementById('tracker-batch-label');
    if (batchLabel && currentDept && currentBatch) {
      batchLabel.textContent = (currentDept.shortName || currentDept.name) + ' — ' + currentBatch.name;
    }

    renderTrackerAndCountdown();
  }

  function refreshFromFeeCalc() {
    renderTrackerAndCountdown();
  }

  function renderTrackerAndCountdown() {
    if (!currentBatch) return;

    const state = loadTrackerState();
    const feeData = window.SEUFee
      ? window.SEUFee.getLatestCalculation()
      : { installments: [0, 0, 0], netPayable: 0 };

    const instAmounts = feeData.installments || [0, 0, 0];
    const instDates = currentBatch.installmentDates || ['', '', ''];
    const instNames = [
      '1st Installment (40%)',
      '2nd Installment (30% — Midterm)',
      '3rd Installment (30% — Final)'
    ];

    const listContainer = document.getElementById('tracker-installments-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    let totalPaid = 0;
    let doneCount = 0;

    state.installments.forEach(function (item, idx) {
      const amount = instAmounts[idx] || 0;
      const dueStr = instDates[idx] || '';
      const formattedDue = dueStr ? formatDate(dueStr) : '';
      const daysUntil = getDaysUntilDue(dueStr);
      const isOverdue = !item.paid && daysUntil !== null && daysUntil < 0;

      if (item.paid) {
        totalPaid += amount;
        doneCount += 1;
      }

      const row = document.createElement('div');
      row.className = 'tracker-item' + (item.paid ? ' is-paid' : '') + (isOverdue ? ' is-overdue' : '');

      let statusBadgeHtml = '';
      if (item.paid) {
        statusBadgeHtml = '<span class="status-tag paid">✓ Paid</span>';
      } else if (isOverdue) {
        statusBadgeHtml = '<span class="status-tag overdue">Overdue by ' + Math.abs(daysUntil) + ' day' + (Math.abs(daysUntil) === 1 ? '' : 's') + '</span>';
      } else if (daysUntil === 0) {
        statusBadgeHtml = '<span class="status-tag overdue">Due Today</span>';
      } else if (daysUntil !== null && daysUntil > 0) {
        statusBadgeHtml = '<span class="status-tag pending">' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's') + ' left</span>';
      } else {
        statusBadgeHtml = '<span class="status-tag pending">Due date not announced yet</span>';
      }

      const formattedAmt = window.SEUFee ? window.SEUFee.formatTaka(amount) : ('৳ ' + amount);

      row.innerHTML =
        '<div class="tracker-item-top">' +
          '<label class="tracker-check-label">' +
            '<input type="checkbox" class="tracker-checkbox" data-idx="' + idx + '" ' + (item.paid ? 'checked' : '') + ' />' +
            '<span>' + instNames[idx] + ' — <strong>' + formattedAmt + '</strong></span>' +
          '</label>' +
          '<div class="tracker-item-badges">' +
            '<span class="inst-due">' + (formattedDue ? ('Due: ' + formattedDue) : 'Due date TBA') + '</span>' +
            statusBadgeHtml +
          '</div>' +
        '</div>' +
        '<div class="tracker-item-inputs">' +
          '<div>' +
            '<label class="form-label" for="tracker-date-' + idx + '">Payment Date (Optional)</label>' +
            '<input type="date" id="tracker-date-' + idx + '" class="form-input tracker-date-input" data-idx="' + idx + '" value="' + escapeAttr(item.paidDate || '') + '" />' +
          '</div>' +
          '<div>' +
            '<label class="form-label" for="tracker-note-' + idx + '">Receipt / bKash / Nagad TrxID Note (Optional)</label>' +
            '<input type="text" id="tracker-note-' + idx + '" class="form-input tracker-note-input" data-idx="' + idx + '" value="' + escapeAttr(item.note || '') + '" />' +
          '</div>' +
        '</div>';

      listContainer.appendChild(row);
    });

    const checkboxes = listContainer.querySelectorAll('.tracker-checkbox');
    checkboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        const i = Number(cb.getAttribute('data-idx'));
        state.installments[i].paid = cb.checked;
        if (cb.checked && !state.installments[i].paidDate) {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          state.installments[i].paidDate = yyyy + '-' + mm + '-' + dd;
        }
        saveTrackerState(state);
        renderTrackerAndCountdown();
      });
    });

    const dateInputs = listContainer.querySelectorAll('.tracker-date-input');
    dateInputs.forEach(function (inp) {
      inp.addEventListener('change', function () {
        const i = Number(inp.getAttribute('data-idx'));
        state.installments[i].paidDate = inp.value;
        saveTrackerState(state);
      });
    });

    const noteInputs = listContainer.querySelectorAll('.tracker-note-input');
    noteInputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        const i = Number(inp.getAttribute('data-idx'));
        state.installments[i].note = inp.value;
        saveTrackerState(state);
      });
    });

    const netPayable = feeData.netPayable || 0;
    const totalRemaining = Math.max(0, netPayable - totalPaid);
    const pctDone = netPayable > 0 ? Math.min(100, Math.round((totalPaid / netPayable) * 100)) : Math.round((doneCount / 3) * 100);

    const paidEl = document.getElementById('tracker-total-paid');
    const remEl = document.getElementById('tracker-total-remaining');
    const countEl = document.getElementById('tracker-done-count');
    const fillEl = document.getElementById('tracker-progress-fill');
    const wrapEl = document.getElementById('tracker-progressbar-wrap');

    if (paidEl && window.SEUFee) paidEl.textContent = window.SEUFee.formatTaka(totalPaid);
    if (remEl && window.SEUFee) remEl.textContent = window.SEUFee.formatTaka(totalRemaining);
    if (countEl) countEl.textContent = doneCount + ' / 3 Done (' + pctDone + '%)';
    if (fillEl) fillEl.style.width = pctDone + '%';
    if (wrapEl) wrapEl.setAttribute('aria-valuenow', String(pctDone));

    updateCountdownBanner(state, instAmounts, instDates, instNames);
  }

  function updateCountdownBanner(state, instAmounts, instDates, instNames) {
    const titleEl = document.getElementById('countdown-title');
    const subEl = document.getElementById('countdown-subtitle');
    const amtEl = document.getElementById('countdown-amount');
    const badgeEl = document.getElementById('countdown-status-badge');

    let nextIdx = -1;
    for (let i = 0; i < state.installments.length; i++) {
      if (!state.installments[i].paid) {
        nextIdx = i;
        break;
      }
    }

    if (nextIdx === -1) {
      if (titleEl) titleEl.textContent = 'All Semester Installments Paid!';
      if (subEl) subEl.textContent = 'You have marked all 3 installments as paid for this semester.';
      if (amtEl) amtEl.textContent = '৳ 0';
      if (badgeEl) {
        badgeEl.className = 'countdown-badge badge-upcoming';
        badgeEl.textContent = 'Completed (3/3)';
      }
      return;
    }

    const nextName = instNames[nextIdx];
    const nextAmount = instAmounts[nextIdx] || 0;
    const nextDateStr = instDates[nextIdx] || '';
    const formattedNextDate = nextDateStr ? formatDate(nextDateStr) : '';
    const daysUntil = getDaysUntilDue(nextDateStr);

    if (titleEl) titleEl.textContent = 'Next Unpaid: ' + nextName;
    if (amtEl && window.SEUFee) amtEl.textContent = window.SEUFee.formatTaka(nextAmount);

    if (daysUntil === null) {
      if (subEl) subEl.textContent = 'Due dates come from the data file. Confirm with the official notice.';
      if (badgeEl) {
        badgeEl.className = 'countdown-badge';
        badgeEl.textContent = 'Due date not announced yet';
      }
    } else if (daysUntil < 0) {
      const overdueDays = Math.abs(daysUntil);
      if (subEl) subEl.textContent = 'Due date was ' + formattedNextDate + '. Due dates come from the data file. Confirm with the official notice.';
      if (badgeEl) {
        badgeEl.className = 'countdown-badge badge-overdue';
        badgeEl.textContent = 'Overdue by ' + overdueDays + ' day' + (overdueDays === 1 ? '' : 's');
      }
    } else if (daysUntil === 0) {
      if (subEl) subEl.textContent = 'Due date is today (' + formattedNextDate + '). Due dates come from the data file. Confirm with the official notice.';
      if (badgeEl) {
        badgeEl.className = 'countdown-badge badge-today';
        badgeEl.textContent = 'Due today';
      }
    } else {
      if (subEl) subEl.textContent = 'Scheduled due date: ' + formattedNextDate + '. Due dates come from the data file. Confirm with the official notice.';
      if (badgeEl) {
        badgeEl.className = 'countdown-badge badge-upcoming';
        badgeEl.textContent = daysUntil + ' day' + (daysUntil === 1 ? '' : 's') + ' left';
      }
    }
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return {
    init: init,
    setBatch: setBatch,
    refreshFromFeeCalc: refreshFromFeeCalc
  };
})();
