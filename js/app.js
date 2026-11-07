/* ==========================================================================
   /js/app.js — MAIN PORTAL CONTROLLER
   - Loads JSON data files (/data/departments.json, /data/grades.json,
     /data/payment-methods.json, /data/faq.json).
   - Manages Global Department & Batch Selector (saved in localStorage).
   - Renders All-Departments 4/5-Year Tuition & Cost Table,
     Documents Section (Feature 6 — showing 'Not uploaded yet' when available=false),
     Payment Method Guide (Feature 7), and searchable FAQ Accordion (Feature 8).
   - Handles Dark Mode toggle (saved in localStorage) and Mobile Menu.
   ========================================================================== */

(function () {
  const STORAGE_KEYS = {
    THEME: 'seu_portal_theme',
    DEPT: 'seu_portal_selected_dept',
    BATCH: 'seu_portal_selected_batch'
  };

  let appData = {
    departments: [],
    grades: null,
    paymentMethods: null,
    faqs: []
  };

  let selectedDept = null;
  let selectedBatch = null;
  let activePaymentTab = 'all';

  function getStored(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStored(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Ignore storage errors
    }
  }

  function initTheme() {
    const savedTheme = getStored(STORAGE_KEYS.THEME, 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        setStored(STORAGE_KEYS.THEME, next);
      });
    }
  }

  function initUIControls() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-nav-menu');

    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', function () {
        const isHidden = mobileMenu.hasAttribute('hidden');
        if (isHidden) {
          mobileMenu.removeAttribute('hidden');
          mobileBtn.setAttribute('aria-expanded', 'true');
        } else {
          mobileMenu.setAttribute('hidden', '');
          mobileBtn.setAttribute('aria-expanded', 'false');
        }
      });

      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.setAttribute('hidden', '');
          mobileBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    const reportBtn = document.getElementById('report-info-btn');
    const reportModal = document.getElementById('report-info-modal');
    const closeReportBtn = document.getElementById('close-report-modal-btn');

    if (reportBtn && reportModal) {
      reportBtn.addEventListener('click', function () {
        reportModal.hidden = false;
      });
    }
    if (closeReportBtn && reportModal) {
      closeReportBtn.addEventListener('click', function () {
        reportModal.hidden = true;
      });
    }
    if (reportModal) {
      reportModal.addEventListener('click', function (e) {
        if (e.target === reportModal) {
          reportModal.hidden = true;
        }
      });
    }
  }

  async function loadAllData() {
    try {
      const [deptRes, gradesRes, payRes, faqRes] = await Promise.all([
        fetch('data/departments.json'),
        fetch('data/grades.json'),
        fetch('data/payment-methods.json'),
        fetch('data/faq.json')
      ]);

      const deptJson = await deptRes.json();
      const gradesJson = await gradesRes.json();
      const payJson = await payRes.json();
      const faqJson = await faqRes.json();

      appData.departments = deptJson.departments || [];
      appData.grades = gradesJson;
      appData.paymentMethods = payJson;
      appData.faqs = faqJson.faqs || [];
    } catch (err) {
      console.error('Error loading JSON files:', err);
    }
  }

  function initGlobalSelector() {
    const deptSelect = document.getElementById('global-dept-select');
    const batchSelect = document.getElementById('global-batch-select');
    if (!deptSelect || !batchSelect || appData.departments.length === 0) return;

    deptSelect.innerHTML = '';
    appData.departments.forEach(function (dept) {
      const opt = document.createElement('option');
      opt.value = dept.id;
      opt.textContent = dept.name + (dept.batchRange ? ' [' + dept.batchRange + ']' : '');
      deptSelect.appendChild(opt);
    });

    const savedDeptId = getStored(STORAGE_KEYS.DEPT, appData.departments[0].id);
    selectedDept = appData.departments.find(function (d) { return d.id === savedDeptId; }) || appData.departments[0];
    deptSelect.value = selectedDept.id;

    populateBatchDropdown(selectedDept, getStored(STORAGE_KEYS.BATCH, ''));

    deptSelect.addEventListener('change', function () {
      const newDept = appData.departments.find(function (d) { return d.id === deptSelect.value; });
      if (newDept) {
        selectedDept = newDept;
        setStored(STORAGE_KEYS.DEPT, selectedDept.id);
        populateBatchDropdown(selectedDept, '');
        syncAllSectionsWithSelection();
      }
    });

    batchSelect.addEventListener('change', function () {
      if (!selectedDept) return;
      const newBatch = (selectedDept.batches || []).find(function (b) { return b.id === batchSelect.value; });
      if (newBatch) {
        selectedBatch = newBatch;
        setStored(STORAGE_KEYS.BATCH, selectedBatch.id);
        syncAllSectionsWithSelection();
      }
    });

    renderAllDepartmentsComparisonTable();
    syncAllSectionsWithSelection();
  }

  function populateBatchDropdown(deptObj, preferredBatchId) {
    const batchSelect = document.getElementById('global-batch-select');
    if (!batchSelect) return;

    const batches = deptObj.batches || [];
    batchSelect.innerHTML = '';

    batches.forEach(function (batch) {
      const opt = document.createElement('option');
      opt.value = batch.id;
      opt.textContent = batch.name;
      batchSelect.appendChild(opt);
    });

    selectedBatch = batches.find(function (b) { return b.id === preferredBatchId; }) || batches[0] || null;
    if (selectedBatch) {
      batchSelect.value = selectedBatch.id;
      setStored(STORAGE_KEYS.BATCH, selectedBatch.id);
    }
  }

  function renderAllDepartmentsComparisonTable() {
    const tbody = document.getElementById('all-depts-cost-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    appData.departments.forEach(function (dept) {
      const tr = document.createElement('tr');
      if (selectedDept && dept.id === selectedDept.id) {
        tr.className = 'active-dept-row';
      }

      const fmt = window.SEUFee ? window.SEUFee.formatTaka : function (n) { return '৳ ' + n; };
      const labStr = dept.labFeeOneTime > 0 ? fmt(dept.labFeeOneTime) : 'N/A';
      const nonCrStr = dept.nonCreditOrVendorFee > 0 ? fmt(dept.nonCreditOrVendorFee) : 'N/A';

      tr.innerHTML =
        '<td><strong>' + escapeHtml(dept.name) + '</strong> <span class="table-subtext">(' + (dept.durationYears || 4) + ' Years)</span></td>' +
        '<td><strong>' + (dept.totalCredits || 0) + '</strong></td>' +
        '<td>' + fmt(dept.perCreditFee) + '</td>' +
        '<td>' + fmt(dept.totalTuitionFee) + '</td>' +
        '<td>' + fmt(dept.activityFeeOneTime) + '</td>' +
        '<td>' + labStr + '</td>' +
        '<td>' + nonCrStr + '</td>' +
        '<td><strong class="highlight-teal">' + fmt(dept.approxTotalCost) + '</strong></td>';

      tbody.appendChild(tr);
    });
  }

  function syncAllSectionsWithSelection() {
    if (!selectedDept || !selectedBatch) return;

    const shortDept = selectedDept.shortName || selectedDept.id.toUpperCase();
    const fmtDate = window.SEUFormatDate ? window.SEUFormatDate : function (s) { return s; };

    setText('nav-batch-label', shortDept + ' • Batch ' + selectedBatch.id);
    setText('hero-school-eyebrow', (selectedDept.school || 'SOUTHEAST UNIVERSITY').toUpperCase());
    setText('hero-profile-title', shortDept + ' — ' + selectedBatch.name);
    setText('hero-updated-tag', 'Updated: ' + fmtDate(selectedBatch.lastUpdated || '2026-11-06'));

    if (window.SEUFee) {
      setText('hero-stat-credit', window.SEUFee.formatTaka(selectedBatch.perCreditFee));
      setText('hero-stat-sem', 'Sem ' + (selectedBatch.currentSemesterNo || 1) + ' • ' + (selectedBatch.totalCredits || 140) + ' Cr (' + (selectedBatch.durationYears || 4) + 'Y)');
      setText('hero-stat-lab', window.SEUFee.formatTaka(selectedBatch.approxTotalCost));
    }

    const rules = selectedBatch.waiverRules || [];
    let maxWaiver = 0;
    rules.forEach(function (r) {
      if (r.percent > maxWaiver) maxWaiver = r.percent;
    });
    setText('hero-stat-waiver', maxWaiver > 0 ? ('Up to ' + maxWaiver + '%') : 'None');

    renderAllDepartmentsComparisonTable();

    if (window.SEUFee) window.SEUFee.setBatch(selectedDept, selectedBatch);
    if (window.SEUWaiver) window.SEUWaiver.setBatch(selectedDept, selectedBatch);
    if (window.SEUTracker) window.SEUTracker.setBatch(selectedDept, selectedBatch);

    renderDocumentsSection(selectedDept, selectedBatch);
  }

  /**
   * FEATURE 6: Render Batch Documents Cards
   * Shows documents with available === false as a disabled card labelled "Not uploaded yet"
   * (no download link, no fake file).
   */
  function renderDocumentsSection(deptObj, batchObj) {
    const labelEl = document.getElementById('docs-batch-label');
    const gridEl = document.getElementById('documents-grid');
    if (labelEl) {
      labelEl.textContent = (deptObj.shortName || deptObj.name) + ' — ' + batchObj.name;
    }
    if (!gridEl) return;

    const docs = batchObj.documents || [];
    gridEl.innerHTML = '';

    if (docs.length === 0) {
      gridEl.innerHTML =
        '<div class="card">' +
          '<p class="card-subtitle">No documents added yet for ' + escapeHtml(deptObj.name) + ' (' + escapeHtml(batchObj.name) + ').</p>' +
        '</div>';
      return;
    }

    docs.forEach(function (doc) {
      const isAvailable = Boolean(doc.available);
      const card = document.createElement('article');
      card.className = 'doc-card' + (isAvailable ? '' : ' doc-card-disabled');

      const parts = (doc.file || '').split('/');
      const fileName = parts[parts.length - 1] || 'document.pdf';

      const actionHtml = isAvailable
        ? '<a href="' + escapeHtml(doc.file || '#documents-section') + '" download="' + escapeHtml(fileName) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm btn-block">' +
            'Download / View PDF' +
          '</a>'
        : '<span class="doc-unavailable-badge" aria-disabled="true">Not uploaded yet</span>';

      card.innerHTML =
        '<div class="doc-card-top">' +
          '<div class="doc-icon-box" aria-hidden="true">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
              '<polyline points="14 2 14 8 20 8"/>' +
            '</svg>' +
            '<span>PDF</span>' +
          '</div>' +
          '<div>' +
            '<h3 class="doc-title">' + escapeHtml(doc.title || 'Batch Document') + '</h3>' +
            '<p class="doc-desc">' + escapeHtml(doc.description || 'Batch academic document.') + '</p>' +
            '<span class="doc-path-tag">' + escapeHtml(doc.file || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="doc-card-actions">' +
          actionHtml +
        '</div>';

      gridEl.appendChild(card);
    });
  }

  function initPaymentMethods() {
    const payData = appData.paymentMethods;
    if (!payData) return;

    const disclaimerText = document.getElementById('payment-disclaimer-text');
    if (disclaimerText && payData.disclaimer) {
      disclaimerText.textContent = payData.disclaimer;
    }

    const methods = payData.methods || [];
    const tabsContainer = document.getElementById('payment-method-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'method-tab-btn active';
    allBtn.textContent = 'All Methods (' + methods.length + ')';
    allBtn.addEventListener('click', function () {
      activePaymentTab = 'all';
      updatePaymentTabsUI();
      renderPaymentCards(methods);
    });
    tabsContainer.appendChild(allBtn);

    methods.forEach(function (m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'method-tab-btn';
      btn.setAttribute('data-method-id', m.id);
      btn.textContent = m.name;
      btn.addEventListener('click', function () {
        activePaymentTab = m.id;
        updatePaymentTabsUI();
        renderPaymentCards(methods.filter(function (item) { return item.id === m.id; }));
      });
      tabsContainer.appendChild(btn);
    });

    renderPaymentCards(methods);
  }

  function updatePaymentTabsUI() {
    const btns = document.querySelectorAll('#payment-method-tabs .method-tab-btn');
    btns.forEach(function (btn) {
      const id = btn.getAttribute('data-method-id') || 'all';
      if (id === activePaymentTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function renderPaymentCards(methodsToRender) {
    const container = document.getElementById('payment-methods-container');
    if (!container) return;

    container.innerHTML = '';

    methodsToRender.forEach(function (m) {
      const card = document.createElement('article');
      card.className = 'method-card';

      const stepsHtml = (m.steps || []).map(function (s) {
        return '<li>' + escapeHtml(s) + '</li>';
      }).join('');

      const notesHtml = (m.notes || []).map(function (n) {
        return '<li>' + escapeHtml(n) + '</li>';
      }).join('');

      card.innerHTML =
        '<div class="method-card-header">' +
          '<div>' +
            '<span class="badge badge-primary">' + escapeHtml(m.badge || 'Payment Method') + '</span>' +
            '<h3 class="card-title" style="margin-top: 0.25rem;">' + escapeHtml(m.name) + '</h3>' +
          '</div>' +
          '<span class="waiver-base-tag">Official payment details must be confirmed with the SEU Accounts Office.</span>' +
        '</div>' +
        '<div class="method-account-box">' +
          '<div>' +
            '<span class="rate-label">' + escapeHtml(m.accountLabel || 'Account / Biller Info') + '</span>' +
            '<strong style="font-size: 0.95rem;">' + escapeHtml(m.accountValue || 'Not available yet') + '</strong>' +
          '</div>' +
          '<div>' +
            '<span class="rate-label">Reference / Student ID Format</span>' +
            '<strong style="font-size: 0.92rem;">' + escapeHtml(m.referenceFormat || 'Your Student ID') + '</strong>' +
          '</div>' +
        '</div>' +
        '<h4 class="waiver-summary-title">General Step-by-Step Guidance:</h4>' +
        '<ol class="method-steps-list">' + stepsHtml + '</ol>' +
        '<div class="method-notes-box">' +
          '<strong>Important Notes:</strong>' +
          '<ul>' + notesHtml + '</ul>' +
        '</div>';

      container.appendChild(card);
    });
  }

  function initFAQ() {
    const searchInput = document.getElementById('faq-search-input');
    renderFAQList('');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderFAQList(searchInput.value.trim().toLowerCase());
      });
    }
  }

  function renderFAQList(query) {
    const container = document.getElementById('faq-accordion-list');
    if (!container) return;

    const filtered = appData.faqs.filter(function (f) {
      if (!query) return true;
      return (
        (f.question && f.question.toLowerCase().includes(query)) ||
        (f.answer && f.answer.toLowerCase().includes(query)) ||
        (f.category && f.category.toLowerCase().includes(query))
      );
    });

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="card">' +
          '<p class="card-subtitle">No matching FAQ questions found for "' + escapeHtml(query) + '". Try searching for "fee", "waiver", "installment", or "retake".</p>' +
        '</div>';
      return;
    }

    filtered.forEach(function (faq, idx) {
      const item = document.createElement('div');
      item.className = 'faq-item' + (idx === 0 ? ' open' : '');

      const answerDivId = 'faq-ans-' + (faq.id || idx);

      item.innerHTML =
        '<button type="button" class="faq-question-btn" aria-expanded="' + (idx === 0 ? 'true' : 'false') + '" aria-controls="' + answerDivId + '">' +
          '<span>' + escapeHtml(faq.question) + '</span>' +
          '<svg class="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<polyline points="6 9 12 15 18 9"/>' +
          '</svg>' +
        '</button>' +
        '<div class="faq-answer" id="' + answerDivId + '" ' + (idx === 0 ? '' : 'hidden') + '>' +
          '<p>' + escapeHtml(faq.answer) + '</p>' +
        '</div>';

      const btn = item.querySelector('.faq-question-btn');
      const ans = item.querySelector('.faq-answer');

      btn.addEventListener('click', function () {
        const isOpen = item.classList.contains('open');
        if (isOpen) {
          item.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
          ans.hidden = true;
        } else {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          ans.hidden = false;
        }
      });

      container.appendChild(item);
    });
  }

  /**
   * PROJECT SOURCE CODE & JSON EXPLORER
   */
  const PROJECT_FILE_PATHS = [
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/fee.js',
    '/js/waiver.js',
    '/js/tracker.js',
    '/js/grade.js',
    '/data/departments.json',
    '/data/grades.json',
    '/data/payment-methods.json',
    '/data/faq.json',
    '/README.md'
  ];

  let activeSourceFilePath = '/index.html';
  let activeSourceFileContent = '';

  async function initSourceExplorer() {
    const tabsEl = document.getElementById('source-file-tabs');
    const copyBtn = document.getElementById('copy-source-file-btn');
    const dlBtn = document.getElementById('download-source-file-btn');
    if (!tabsEl) return;

    tabsEl.innerHTML = '';
    PROJECT_FILE_PATHS.forEach(function (filePath) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'method-tab-btn' + (filePath === activeSourceFilePath ? ' active' : '');
      btn.setAttribute('data-filepath', filePath);
      btn.textContent = filePath;
      btn.addEventListener('click', function () {
        activeSourceFilePath = filePath;
        tabsEl.querySelectorAll('.method-tab-btn').forEach(function (b) {
          if (b.getAttribute('data-filepath') === filePath) b.classList.add('active');
          else b.classList.remove('active');
        });
        loadAndShowSourceFile(filePath);
      });
      tabsEl.appendChild(btn);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyTextSafe(activeSourceFileContent, function () {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(function () {
            copyBtn.textContent = 'Copy File Code';
          }, 2000);
        });
      });
    }

    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        const cleanName = activeSourceFilePath.split('/').pop() || 'file.txt';
        const blob = new Blob([activeSourceFileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cleanName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }

    await loadAndShowSourceFile(activeSourceFilePath);
  }

  async function loadAndShowSourceFile(filePath) {
    const pathEl = document.getElementById('active-source-path');
    const linesEl = document.getElementById('active-source-lines');
    const codeEl = document.getElementById('source-code-display');
    if (pathEl) pathEl.textContent = filePath;

    let content = '';
    const relKey = filePath.replace(/^\//, '');
    if (window.__SEU_SOURCE_FILES__ && Object.prototype.hasOwnProperty.call(window.__SEU_SOURCE_FILES__, filePath)) {
      content = window.__SEU_SOURCE_FILES__[filePath];
    } else if (window.__SEU_INLINE_DATA__ && Object.prototype.hasOwnProperty.call(window.__SEU_INLINE_DATA__, relKey)) {
      content = JSON.stringify(window.__SEU_INLINE_DATA__[relKey], null, 2);
    } else {
      try {
        const res = await fetch(relKey);
        content = await res.text();
      } catch (e) {
        content = '// Open via local server or inspect inside the downloaded ZIP archive: ' + filePath;
      }
    }

    activeSourceFileContent = content;
    const lineCount = content.split('\n').length;
    if (linesEl) linesEl.textContent = lineCount + ' lines • Complete code';
    if (codeEl) codeEl.textContent = content;
  }

  function copyTextSafe(text, onSuccess) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  }

  function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (onSuccess) onSuccess();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', async function () {
    initTheme();
    initUIControls();

    if (window.SEUFee) window.SEUFee.init();
    if (window.SEUWaiver) window.SEUWaiver.init();
    if (window.SEUTracker) window.SEUTracker.init();

    await loadAllData();

    if (window.SEUGrade) window.SEUGrade.init(appData.grades);

    initGlobalSelector();
    initPaymentMethods();
    initFAQ();
    initSourceExplorer();
  });
})();
