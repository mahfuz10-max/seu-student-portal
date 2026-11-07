/* ==========================================================================
   /js/grade.js — GRADE, CGPA & TARGET CGPA CALCULATOR (FEATURE 5)
   - Loads SEU 4.00 grading scale from data/grades.json.
   - Calculates Semester GPA (SGPA) and Cumulative CGPA instantaneously on
     every input/change event.
   - Shows inline warning in #grade-error-msg if any course row has an empty
     or invalid credit value.
   - Supports simple course Retake checkbox where the new grade replaces the
     previous grade in cumulative CGPA calculations.
   - Includes Target CGPA Planner showing the exact GPA needed next semester.
   ========================================================================== */

window.SEUGrade = (function () {
  let gradesList = [];
  let courses = [];
  let nextCourseId = 1;

  function getInitialCourses() {
    return [
      { id: nextCourseId++, name: 'Course 1 (Theory)', credit: 3, rawCredit: '3', gradePoint: 4.00, isRetake: false, oldGradePoint: 2.00 },
      { id: nextCourseId++, name: 'Course 2 (Theory)', credit: 3, rawCredit: '3', gradePoint: 3.75, isRetake: false, oldGradePoint: 2.00 },
      { id: nextCourseId++, name: 'Course 3 (Theory)', credit: 3, rawCredit: '3', gradePoint: 3.50, isRetake: false, oldGradePoint: 2.00 },
      { id: nextCourseId++, name: 'Course 4 (Lab)', credit: 1.5, rawCredit: '1.5', gradePoint: 4.00, isRetake: false, oldGradePoint: 2.00 }
    ];
  }

  function init(gradesData) {
    gradesList = (gradesData && Array.isArray(gradesData.grades)) ? gradesData.grades : [];

    renderGradingScaleTable(gradesData);

    courses = getInitialCourses();
    renderCourseRows();
    calculateGPAAndCGPA();

    const addCourseBtn = document.getElementById('add-course-btn');
    const resetCoursesBtn = document.getElementById('reset-courses-btn');
    const prevCreditsInput = document.getElementById('prev-credits-input');
    const prevCgpaInput = document.getElementById('prev-cgpa-input');

    if (addCourseBtn) {
      addCourseBtn.addEventListener('click', function () {
        courses.push({
          id: nextCourseId++,
          name: 'Course ' + (courses.length + 1),
          credit: 3,
          rawCredit: '3',
          gradePoint: 3.75,
          isRetake: false,
          oldGradePoint: 2.00
        });
        renderCourseRows();
        calculateGPAAndCGPA();
      });
    }

    if (resetCoursesBtn) {
      resetCoursesBtn.addEventListener('click', function () {
        courses = getInitialCourses();
        if (prevCreditsInput) prevCreditsInput.value = '';
        if (prevCgpaInput) prevCgpaInput.value = '';
        renderCourseRows();
        calculateGPAAndCGPA();
      });
    }

    [prevCreditsInput, prevCgpaInput].forEach(function (inp) {
      if (inp) {
        ['input', 'change'].forEach(function (evt) {
          inp.addEventListener(evt, function () {
            calculateGPAAndCGPA();
          });
        });
      }
    });

    const targetInputs = [
      document.getElementById('target-curr-cgpa'),
      document.getElementById('target-comp-credits'),
      document.getElementById('target-goal-cgpa'),
      document.getElementById('target-next-credits')
    ];
    targetInputs.forEach(function (inp) {
      if (inp) {
        ['input', 'change'].forEach(function (evt) {
          inp.addEventListener(evt, function () {
            calculateTargetCGPA();
          });
        });
      }
    });

    calculateTargetCGPA();
  }

  function renderGradingScaleTable(gradesData) {
    const tbody = document.getElementById('grading-scale-tbody');
    const noteEl = document.getElementById('grading-policy-note');

    if (noteEl && gradesData && gradesData.policyNote) {
      noteEl.textContent = gradesData.policyNote;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    gradesList.forEach(function (g) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + g.range + '</td>' +
        '<td><strong>' + g.letter + '</strong></td>' +
        '<td>' + Number(g.point).toFixed(2) + '</td>' +
        '<td>' + (g.description || '') + '</td>';
      tbody.appendChild(tr);
    });
  }

  function buildGradeOptionsHtml(selectedPoint) {
    return gradesList.map(function (g) {
      const isSelected = Math.abs(Number(g.point) - Number(selectedPoint)) < 0.001;
      return '<option value="' + g.point + '" ' + (isSelected ? 'selected' : '') + '>' +
        g.letter + ' (' + Number(g.point).toFixed(2) + ' — ' + g.range + ')' +
      '</option>';
    }).join('');
  }

  function renderCourseRows() {
    const container = document.getElementById('course-rows-container');
    if (!container) return;

    container.innerHTML = '';

    courses.forEach(function (course) {
      const row = document.createElement('div');
      row.className = 'course-row';
      const creditValStr = course.rawCredit !== undefined ? course.rawCredit : String(course.credit);

      row.innerHTML =
        '<div class="course-row-grid">' +
          '<div>' +
            '<label class="form-label" for="course-name-' + course.id + '">Course Name (Optional)</label>' +
            '<input type="text" id="course-name-' + course.id + '" class="form-input course-name-inp" data-id="' + course.id + '" value="' + escapeAttr(course.name) + '" />' +
          '</div>' +
          '<div>' +
            '<label class="form-label" for="course-cr-' + course.id + '">Credits</label>' +
            '<input type="number" id="course-cr-' + course.id + '" class="form-input course-cr-inp" data-id="' + course.id + '" min="0.5" max="12" step="0.5" value="' + escapeAttr(creditValStr) + '" />' +
          '</div>' +
          '<div>' +
            '<label class="form-label" for="course-gr-' + course.id + '">Expected / Earned Grade</label>' +
            '<select id="course-gr-' + course.id + '" class="form-select course-gr-sel" data-id="' + course.id + '">' +
              buildGradeOptionsHtml(course.gradePoint) +
            '</select>' +
          '</div>' +
          '<div>' +
            '<button type="button" class="btn btn-danger-outline btn-sm remove-course-btn" data-id="' + course.id + '" ' + (courses.length <= 1 ? 'disabled' : '') + ' title="Remove course row">' +
              'Remove' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="course-retake-bar">' +
          '<label class="retake-check-wrap">' +
            '<input type="checkbox" class="course-retake-cb" data-id="' + course.id + '" ' + (course.isRetake ? 'checked' : '') + ' />' +
            '<span>Retake Course (replaces previous grade in CGPA)</span>' +
          '</label>' +
          '<div class="retake-prev-grade-wrap" ' + (course.isRetake ? '' : 'hidden') + '>' +
            '<label for="course-oldgr-' + course.id + '">Previous Grade:</label>' +
            '<select id="course-oldgr-' + course.id + '" class="retake-prev-select course-oldgr-sel" data-id="' + course.id + '">' +
              buildGradeOptionsHtml(course.oldGradePoint) +
            '</select>' +
          '</div>' +
        '</div>';

      container.appendChild(row);
    });

    container.querySelectorAll('.course-name-inp').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const c = findCourse(inp.getAttribute('data-id'));
        if (c) c.name = inp.value;
      });
    });

    container.querySelectorAll('.course-cr-inp').forEach(function (inp) {
      ['input', 'change'].forEach(function (evt) {
        inp.addEventListener(evt, function () {
          const c = findCourse(inp.getAttribute('data-id'));
          if (c) {
            c.rawCredit = inp.value;
            c.credit = inp.value.trim() === '' ? NaN : parseFloat(inp.value);
            calculateGPAAndCGPA();
          }
        });
      });
    });

    container.querySelectorAll('.course-gr-sel').forEach(function (sel) {
      ['input', 'change'].forEach(function (evt) {
        sel.addEventListener(evt, function () {
          const c = findCourse(sel.getAttribute('data-id'));
          if (c) {
            c.gradePoint = parseFloat(sel.value) || 0;
            calculateGPAAndCGPA();
          }
        });
      });
    });

    container.querySelectorAll('.course-retake-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const c = findCourse(cb.getAttribute('data-id'));
        if (c) {
          c.isRetake = cb.checked;
          renderCourseRows();
          calculateGPAAndCGPA();
        }
      });
    });

    container.querySelectorAll('.course-oldgr-sel').forEach(function (sel) {
      ['input', 'change'].forEach(function (evt) {
        sel.addEventListener(evt, function () {
          const c = findCourse(sel.getAttribute('data-id'));
          if (c) {
            c.oldGradePoint = parseFloat(sel.value) || 0;
            calculateGPAAndCGPA();
          }
        });
      });
    });

    container.querySelectorAll('.remove-course-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (courses.length <= 1) return;
        const idToRemove = Number(btn.getAttribute('data-id'));
        courses = courses.filter(function (c) { return c.id !== idToRemove; });
        renderCourseRows();
        calculateGPAAndCGPA();
      });
    });
  }

  function findCourse(id) {
    const numId = Number(id);
    for (let i = 0; i < courses.length; i++) {
      if (courses[i].id === numId) return courses[i];
    }
    return null;
  }

  function calculateGPAAndCGPA() {
    const prevCrRaw = document.getElementById('prev-credits-input').value.trim();
    const prevCgpaRaw = document.getElementById('prev-cgpa-input').value.trim();
    const errorEl = document.getElementById('grade-error-msg');

    const prevCredits = prevCrRaw === '' ? 0 : parseFloat(prevCrRaw);
    const prevCgpa = prevCgpaRaw === '' ? 0 : parseFloat(prevCgpaRaw);

    let err = '';
    if (prevCredits < 0 || isNaN(prevCredits)) {
      err = 'Previous completed credits cannot be negative.';
    } else if (prevCgpa < 0 || prevCgpa > 4.00 || isNaN(prevCgpa)) {
      err = 'Previous CGPA must be between 0.00 and 4.00.';
    }

    const safePrevCr = isNaN(prevCredits) ? 0 : Math.max(0, prevCredits);
    const safePrevCgpa = isNaN(prevCgpa) ? 0 : Math.min(4.00, Math.max(0, prevCgpa));

    let semCredits = 0;
    let semQualityPoints = 0;
    let newNonRetakeCredits = 0;
    let retakePointsAdjustment = 0;
    let hasInvalidCourseCredit = false;

    courses.forEach(function (c) {
      const parsedCr = Number(c.credit);
      if (isNaN(parsedCr) || parsedCr <= 0) {
        hasInvalidCourseCredit = true;
      }
      const cr = (!isNaN(parsedCr) && parsedCr > 0) ? parsedCr : 0;
      const gp = Number(c.gradePoint) || 0;

      semCredits += cr;
      semQualityPoints += (cr * gp);

      if (c.isRetake) {
        const oldGp = Number(c.oldGradePoint) || 0;
        retakePointsAdjustment += cr * (gp - oldGp);
      } else {
        newNonRetakeCredits += cr;
        retakePointsAdjustment += cr * gp;
      }
    });

    if (hasInvalidCourseCredit && !err) {
      err = 'Enter credits for every course row or remove the empty row';
    }

    if (errorEl) {
      if (err) {
        errorEl.textContent = err;
        errorEl.hidden = false;
      } else {
        errorEl.hidden = true;
      }
    }

    const semGPA = semCredits > 0 ? (semQualityPoints / semCredits) : 0;

    let totalCredits = semCredits;
    let cumulativeCGPA = semGPA;

    if (safePrevCr > 0) {
      const prevTotalPoints = safePrevCr * safePrevCgpa;
      totalCredits = safePrevCr + newNonRetakeCredits;
      const updatedTotalPoints = Math.max(0, prevTotalPoints + retakePointsAdjustment);
      cumulativeCGPA = totalCredits > 0 ? Math.min(4.00, updatedTotalPoints / totalCredits) : 0;
    }

    setText('res-sem-credits', semCredits.toFixed(1));
    setText('res-sem-gpa', semGPA.toFixed(2));
    setText('res-total-credits', totalCredits.toFixed(1));
    setText('res-cum-cgpa', cumulativeCGPA.toFixed(2));
  }

  function calculateTargetCGPA() {
    const currCgpa = parseFloat(document.getElementById('target-curr-cgpa').value);
    const compCr = parseFloat(document.getElementById('target-comp-credits').value);
    const goalCgpa = parseFloat(document.getElementById('target-goal-cgpa').value);
    const nextCr = parseFloat(document.getElementById('target-next-credits').value);

    const gpaOutEl = document.getElementById('target-required-gpa');
    const noteOutEl = document.getElementById('target-result-note');

    if (
      isNaN(currCgpa) || currCgpa < 0 || currCgpa > 4 ||
      isNaN(compCr) || compCr < 0 ||
      isNaN(goalCgpa) || goalCgpa < 0 || goalCgpa > 4 ||
      isNaN(nextCr) || nextCr <= 0
    ) {
      if (gpaOutEl) gpaOutEl.textContent = '—';
      if (noteOutEl) noteOutEl.textContent = 'Enter valid CGPA (0.00–4.00) and credit numbers above.';
      return;
    }

    const currentPoints = currCgpa * compCr;
    const targetPoints = goalCgpa * (compCr + nextCr);
    const neededPointsNextSem = targetPoints - currentPoints;
    const neededGPA = neededPointsNextSem / nextCr;

    if (gpaOutEl) {
      gpaOutEl.textContent = neededGPA.toFixed(2);
    }

    if (neededGPA > 4.00) {
      if (gpaOutEl) gpaOutEl.className = 'target-result-gpa text-danger';
      if (noteOutEl) {
        const maxPossibleCgpa = ((currentPoints + 4.00 * nextCr) / (compCr + nextCr)).toFixed(2);
        noteOutEl.textContent = 'Impossible in a single semester (requires > 4.00 GPA). Even with a 4.00 GPA next semester, your maximum CGPA will be ' + maxPossibleCgpa + '.';
      }
    } else if (neededGPA <= 0) {
      if (gpaOutEl) gpaOutEl.className = 'target-result-gpa text-success';
      if (noteOutEl) {
        noteOutEl.textContent = 'You have already comfortably exceeded this target CGPA!';
      }
    } else {
      if (gpaOutEl) gpaOutEl.className = 'target-result-gpa';
      if (noteOutEl) {
        noteOutEl.textContent = 'Achievable! You need an average GPA of ' + neededGPA.toFixed(2) + ' across your ' + nextCr + ' upcoming credits.';
      }
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return {
    init: init
  };
})();
