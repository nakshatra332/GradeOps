/**
 * pages/reports.js — Grade distribution and export options.
 */

import { showToast } from '../components/toast.js';
import { getExams } from '../api/exams.js';

async function getGradeReport() {
  const exams = await getExams();
  const gradedExam = exams.find(e => e.status === 'graded');
  return {
    classAvg:     36.4,
    highest:      47,
    lowest:       18,
    passRate:     82,
    totalMarks:   50,
    distribution: [
      { label: '0–10',  count: 3  },
      { label: '11–20', count: 5  },
      { label: '21–25', count: 9  },
      { label: '26–30', count: 12 },
      { label: '31–35', count: 8  },
      { label: '36–40', count: 4  },
      { label: '41–45', count: 2  },
      { label: '46–50', count: 1  },
    ],
    exam: gradedExam?.name ?? 'N/A',
  };
}

export async function render(container) {
  const report   = await getGradeReport();
  const maxCount = Math.max(...report.distribution.map(d => d.count));
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
