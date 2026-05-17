<<<<<<< HEAD
/**
 * pages/reports.js — Grade distribution and export options.
 */

import { showToast } from '../components/toast.js';
import { getExams } from '../api/exams.js';

import { getPipelineState } from '../api/pipeline.js';

async function getGradeReport() {
  const exams = await getExams();
  // Find the most recently graded exam (assuming newer exams are at the start of the array)
  const gradedExam = exams.find(e => e.status === 'graded');

  if (!gradedExam) {
    return null; // Handle empty state in render
  }

  const state = await getPipelineState(gradedExam.id);
  const stats = state.stats || {};
  const totalMarks = stats.total_marks || 100;

  // Calculate dynamic score distribution (8 buckets)
  const students = state.students || [];
  const scores = students.map(s => s.final_score).filter(s => s != null);
  
  const bucketCount = 8;
  const interval = totalMarks / bucketCount;
  const distribution = Array.from({ length: bucketCount }, (_, i) => {
    const min = i * interval;
    const max = (i === bucketCount - 1) ? totalMarks : (i + 1) * interval;
    const label = i === bucketCount - 1 
      ? `${Math.round(min)}–${Math.round(max)}` 
      : `${Math.round(min)}–${Math.round(max - 0.1)}`;
    return { label, count: 0, min, max: (i === bucketCount - 1) ? Infinity : max };
  });

  scores.forEach(score => {
    for (const b of distribution) {
      if (score >= b.min && score < b.max) {
        b.count++;
        break;
      }
=======
import { showToast } from '../components/toast.js';
import { getExams }  from '../api/exams.js';
import { getPipelineState } from '../api/pipeline.js';
import { getCourses } from '../api/courses.js';
import { store } from '../state.js';

// Use the current origin as the API base if we're not on the default dev port (3000)
const API_BASE = window.location.port === '3000' ? 'http://localhost:8000' : '';

// ── Data loading ──────────────────────────────────────────────────────────────

async function getCourseReport(courseId = null) {
  const [exams, courses] = await Promise.all([getExams(), getCourses()]);
  
  if (!courses.length) return { courses: [], report: null, selectedCourseId: null };

  const selectedCourse = courseId
    ? courses.find(c => String(c.id) === String(courseId)) ?? courses[0]
    : (courses.find(c => c.id === store.selectedCourseId) ?? courses[0]);

  // Find exams for this course (both graded and in-progress)
  const relevantExams = exams.filter(e => (e.courseId === selectedCourse.id || e.course_id === selectedCourse.id));
  const gradedExams   = relevantExams.filter(e => e.status === 'graded');
  const pendingCount  = relevantExams.length - gradedExams.length;

  if (!gradedExams.length) {
    return { courses, report: null, selectedCourseId: selectedCourse.id, pendingCount, totalCount: relevantExams.length };
  }

  // Aggregate stats from all exams in this course
  let totalStudents = 0;
  let totalOverridden = 0;
  let totalPlagiarism = 0;
  let maxScorePossible = 0;
  let highestScore = 0;
  let lowestScore = Infinity;
  let sumScores = 0;
  let totalPassing = 0;
  let sumAgreement = 0;
  
  const allScores = [];

  for (const exam of gradedExams) {
    try {
      const state = await getPipelineState(exam.id);
      const stats = state.stats || {};
      const students = state.students || [];
      
      const examStudents = stats.total_students ?? students.length;
      totalStudents += examStudents;
      totalOverridden += students.filter(s => s.ta_decision === 'override').length;
      totalPlagiarism += stats.flagged_plagiarism ?? 0;
      
      const examMaxMarks = stats.total_marks || 100;
      maxScorePossible = Math.max(maxScorePossible, examMaxMarks); // simplified: assumes same scale
      
      highestScore = Math.max(highestScore, stats.highest ?? 0);
      lowestScore = Math.min(lowestScore, stats.lowest ?? 100);
      
      sumScores += (stats.class_average || 0) * examStudents;
      totalPassing += ((stats.pass_rate || 0) / 100) * examStudents;
      sumAgreement += (stats.ai_ta_agreement_rate || 0) * examStudents;
      
      students.forEach(s => {
        if (s.final_score != null) allScores.push(s.final_score);
      });
    } catch (err) {
      console.warn(`Failed to fetch state for exam ${exam.id}:`, err);
    }
  }

  if (totalStudents === 0) return { courses, report: null, selectedCourseId: selectedCourse.id };

  const classAvg = sumScores / totalStudents;
  const passRate = (totalPassing / totalStudents) * 100;
  const agreementRate = sumAgreement / totalStudents;

  // Score distribution (8 equal buckets based on maxScorePossible)
  const bucketCount = 8;
  const interval    = maxScorePossible / bucketCount;
  const distribution = Array.from({ length: bucketCount }, (_, i) => {
    const min   = i * interval;
    const max   = (i === bucketCount - 1) ? maxScorePossible : (i + 1) * interval;
    const label = `${Math.round(min)}–${Math.round(i === bucketCount - 1 ? max : max - 0.1)}`;
    return { label, count: 0, min, max: (i === bucketCount - 1) ? Infinity : max };
  });

  allScores.forEach(score => {
    for (const b of distribution) {
      if (score >= b.min && score < b.max) { b.count++; break; }
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    }
  });

  return {
<<<<<<< HEAD
    classAvg:     stats.class_average ?? 0,
    highest:      stats.highest ?? 0,
    lowest:       stats.lowest ?? 0,
    passRate:     stats.pass_rate ?? 0,
    totalMarks:   totalMarks,
    distribution: distribution,
    exam:         gradedExam.name,
  };
}

export async function render(container) {
  const report = await getGradeReport();
  
  if (!report) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Grade report</h1>
      </div>
      <div class="empty" style="padding:60px 20px">
        <i class="ti ti-chart-bar" aria-hidden="true" style="font-size:48px;color:var(--neutral-300);margin-bottom:16px"></i>
        <p>No graded exams available</p>
        <small style="color:var(--neutral-500)">Complete a TA review first to see the score distribution and metrics.</small>
      </div>
    `;
=======
    courses,
    selectedCourseId: selectedCourse.id,
    report: {
      courseId:     selectedCourse.id,
      courseName:   selectedCourse.name,
      courseCode:   selectedCourse.code,
      classAvg:     parseFloat(classAvg.toFixed(1)),
      highest:      highestScore,
      lowest:       lowestScore === Infinity ? 0 : lowestScore,
      passRate:     Math.round(passRate),
      totalMarks:   maxScorePossible,
      totalStudents: totalStudents,
      overridden:   totalOverridden,
      agreementRate: Math.round(agreementRate),
      flaggedPlagiarism: totalPlagiarism,
      distribution,
      examCount:    gradedExams.length,
      pendingCount: pendingCount
    },
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function render(container, selectedCourseId = null) {
  // Show loading skeleton
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Grade reports</h1>
    </div>
    <div class="empty" style="padding:60px 20px">
      <i class="ti ti-loader-2 ti-spin" style="font-size:36px;color:var(--brand)" aria-hidden="true"></i>
      <p style="margin-top:12px">Loading course statistics…</p>
    </div>`;

  const { courses, report, selectedCourseId: resolvedId, pendingCount, totalCount } = await getCourseReport(selectedCourseId);

  if (!courses.length) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Grade reports</h1>
      </div>
      <div class="empty" style="padding:60px 20px">
        <i class="ti ti-book-off" aria-hidden="true" style="font-size:48px;color:var(--neutral-300);margin-bottom:16px"></i>
        <p>No courses found</p>
        <small style="color:var(--neutral-500)">Add a course in the Course Manager first.</small>
      </div>`;
    return;
  }

  // Build course selector
  const selectorHtml = `
    <select id="course-selector" style="margin-right:8px;padding:6px 10px;border:1px solid var(--neutral-200);border-radius:var(--radius-md);font-size:var(--text-sm);font-family:inherit;cursor:pointer">
      ${courses.map(c => `<option value="${c.id}" ${String(c.id) === String(resolvedId) ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join('')}
    </select>`;

  if (!report) {
    const message = totalCount > 0 
      ? `You have ${totalCount} exam(s) in this course, but none are fully graded yet.`
      : `No exams have been uploaded for this course yet.`;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Grade reports</h1>
          <p class="page-sub">Aggregated statistics per course</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${selectorHtml}
        </div>
      </div>
      <div class="empty" style="padding:60px 20px">
        <i class="ti ti-chart-bar" aria-hidden="true" style="font-size:48px;color:var(--neutral-300);margin-bottom:16px"></i>
        <p>${message}</p>
        <small style="color:var(--neutral-500)">Statistics appear here once the TA review is completed for at least one exam.</small>
      </div>`;
    
    container.querySelector('#course-selector')?.addEventListener('change', e => {
      render(container, e.target.value);
    });
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    return;
  }

  const maxCount = Math.max(...report.distribution.map(d => d.count), 1);
  const avgPct   = Math.round(report.classAvg / report.totalMarks * 100);

  container.innerHTML = `
<<<<<<< HEAD
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Grade report</h1>
        <p class="page-sub">${report.exam}</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="export-csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
        <button class="btn" id="export-pdf"><i class="ti ti-file-text" aria-hidden="true"></i> Export PDF</button>
        <button class="btn" id="copy-summary"><i class="ti ti-copy" aria-hidden="true"></i> Copy</button>
      </div>
    </div>

    <div class="metrics" style="margin-bottom:20px">
      <div class="metric">
        <div class="metric-label">Class average</div>
        <div class="metric-value">${report.classAvg}<span style="font-size:var(--text-sm);color:var(--neutral-400);font-weight:400"> / ${report.totalMarks}</span></div>
        <div class="metric-sub">${avgPct}% of total</div>
      </div>
      <div class="metric">
        <div class="metric-label">Highest</div>
        <div class="metric-value green">${report.highest}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Lowest</div>
        <div class="metric-value red">${report.lowest}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Pass rate</div>
        <div class="metric-value">${report.passRate}%</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Score distribution</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:120px;margin-bottom:4px">
        ${report.distribution.map(d => {
          const h    = Math.max(Math.round(d.count / maxCount * 100), 4);
          const isHigh = d.count === maxCount;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style="font-size:10px;color:var(--neutral-400);font-weight:500">${d.count}</span>
              <div style="width:100%;height:${h}px;background:${isHigh ? 'var(--brand-dark)' : 'var(--brand-tint2)'};border-radius:4px 4px 0 0;transition:background var(--t-fast)"
=======
    <div class="page-header" id="print-header">
      <div class="page-header-left">
        <h1 class="page-title">Grade reports</h1>
        <p class="page-sub">${report.courseCode} — ${report.courseName}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${selectorHtml}
        <button class="btn" id="export-pdf"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
        <button class="btn" id="copy-summary"><i class="ti ti-copy" aria-hidden="true"></i> Copy Summary</button>
      </div>
    </div>

    <div class="metrics" style="margin-bottom:20px" id="print-metrics">
      <div class="metric">
        <div class="metric-label">Course average</div>
        <div class="metric-value">${report.classAvg}<span style="font-size:var(--text-sm);color:var(--neutral-400);font-weight:400"> / ${report.totalMarks}</span></div>
        <div class="metric-sub">${avgPct}% weighted avg</div>
      </div>
      <div class="metric">
        <div class="metric-label">Exams graded</div>
        <div class="metric-value">${report.examCount}</div>
        <div class="metric-sub">Total student entries: ${report.totalStudents}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Highest / Lowest</div>
        <div class="metric-value"><span class="green">${report.highest}</span> <span style="color:var(--neutral-300)">/</span> <span class="red">${report.lowest}</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg. Pass rate</div>
        <div class="metric-value">${report.passRate}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">AI–TA agreement</div>
        <div class="metric-value">${report.agreementRate}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Plagiarism flags</div>
        <div class="metric-value ${report.flaggedPlagiarism > 0 ? 'amber' : ''}">${report.flaggedPlagiarism}</div>
      </div>
    </div>

    <div class="card" id="print-chart">
      <div class="card-title">Score distribution — All exams in course</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:140px;margin-bottom:6px">
        ${report.distribution.map(d => {
          const h      = Math.max(Math.round(d.count / maxCount * 100), 4);
          const isHigh = d.count === maxCount && d.count > 0;
          const isEmpty = d.count === 0;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style="font-size:10px;color:var(--neutral-400);font-weight:500">${d.count || ''}</span>
              <div style="width:100%;height:${h}px;background:${isEmpty ? 'var(--neutral-100)' : isHigh ? 'var(--brand-dark)' : 'var(--brand-tint2)'};border-radius:4px 4px 0 0;transition:background var(--t-fast)"
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
                   role="img" aria-label="${d.label}: ${d.count} students"></div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px">
        ${report.distribution.map(d => `
          <div style="flex:1;text-align:center;font-size:9px;color:var(--neutral-400)">${d.label}</div>`).join('')}
      </div>
    </div>`;

<<<<<<< HEAD
  bindExportEvents(container, report);
}

function bindExportEvents(container, report) {
  container.querySelector('#export-csv').addEventListener('click', () => showToast('Downloading grades.csv…'));
  container.querySelector('#export-pdf').addEventListener('click', () => showToast('Generating PDF…'));
  container.querySelector('#copy-summary').addEventListener('click', async () => {
    const text = `${report.exam}\nAvg: ${report.classAvg}/${report.totalMarks} · High: ${report.highest} · Low: ${report.lowest} · Pass: ${report.passRate}%`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Summary copied');
=======
  bindEvents(container, report);
}

// ── Event binding ─────────────────────────────────────────────────────────────

function bindEvents(container, report) {
  // Course selector
  container.querySelector('#course-selector')?.addEventListener('change', e => {
    render(container, e.target.value);
  });

  // Export PDF — print dialog
  container.querySelector('#export-pdf').addEventListener('click', () => {
    const printContent = `
      <!DOCTYPE html><html><head>
        <title>Course Report — ${report.courseCode}</title>
        <style>
          body { font-family: Inter, system-ui, sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
          .metric { border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px; }
          .metric-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .metric-value { font-size: 22px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 24px; }
          th { text-align: left; padding: 8px; border-bottom: 2px solid #111; font-size: 11px; color: #444; }
          td { padding: 8px; border-bottom: 1px solid #e5e5e5; }
          @media print { @page { margin: 20mm; } }
        </style>
      </head><body>
        <h1>Course Grade Report</h1>
        <div class="sub">${report.courseCode} — ${report.courseName} · ${report.examCount} exams · Exported ${new Date().toLocaleDateString()}</div>
        <div class="metrics">
          <div class="metric"><div class="metric-label">Course average</div><div class="metric-value">${report.classAvg} / ${report.totalMarks}</div></div>
          <div class="metric"><div class="metric-label">Pass rate</div><div class="metric-value">${report.passRate}%</div></div>
          <div class="metric"><div class="metric-label">Total students</div><div class="metric-value">${report.totalStudents}</div></div>
          <div class="metric"><div class="metric-label">Highest score</div><div class="metric-value">${report.highest}</div></div>
          <div class="metric"><div class="metric-label">Lowest score</div><div class="metric-value">${report.lowest}</div></div>
          <div class="metric"><div class="metric-label">AI–TA agreement</div><div class="metric-value">${report.agreementRate}%</div></div>
        </div>
        <table>
          <thead><tr><th>Score range</th><th>Students (Aggregate)</th></tr></thead>
          <tbody>
            ${report.distribution.map(d => `<tr><td>${d.label}</td><td>${d.count}</td></tr>`).join('')}
          </tbody>
        </table>
      </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(printContent);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
    showToast('Print dialog opened');
  });

  // Copy summary
  container.querySelector('#copy-summary').addEventListener('click', async () => {
    const text = `Course Report: ${report.courseCode} — ${report.courseName}\nAvg: ${report.classAvg}/${report.totalMarks} · Exams: ${report.examCount} · High: ${report.highest} · Low: ${report.lowest} · Pass: ${report.passRate}% · Students: ${report.totalStudents}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Summary copied ✓');
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    } catch {
      showToast('Copy failed — check browser permissions', 'error');
    }
  });
}
