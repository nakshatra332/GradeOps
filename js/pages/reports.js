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
    }
  });

  return {
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
    return;
  }

  const maxCount = Math.max(...report.distribution.map(d => d.count), 1);
  const avgPct   = Math.round(report.classAvg / report.totalMarks * 100);

  container.innerHTML = `
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
                   role="img" aria-label="${d.label}: ${d.count} students"></div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px">
        ${report.distribution.map(d => `
          <div style="flex:1;text-align:center;font-size:9px;color:var(--neutral-400)">${d.label}</div>`).join('')}
      </div>
    </div>`;

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
    } catch {
      showToast('Copy failed — check browser permissions', 'error');
    }
  });
}
