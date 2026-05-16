/**
 * pages/dashboard.js — Instructor overview dashboard.
 */

import { getExams } from '../api/exams.js';
import { navigate } from '../router.js';

const STATUS_BADGE = {
  graded:     'badge-green',
  processing: 'badge-amber',
  pending:    'badge-gray',
};

const STATUS_LABEL = { graded: 'Graded', processing: 'In progress', pending: 'Not started' };

export async function render(container) {
  const exams = await getExams();
  
  const totalStudents = exams.reduce((s, e) => s + (e.students || 0), 0);
  const gradedCount   = exams.filter(e => e.status === 'graded').length;
  const pendingExams  = exams.filter(e => e.status === 'processing');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Overview</h1>
        <p class="page-sub">Activity at a glance</p>
      </div>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-icon" style="background:var(--neutral-100);color:var(--neutral-600)">
          <i class="ti ti-files" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Total exams</div>
        <div class="metric-value">${exams.length}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--brand-tint);color:var(--brand-dark)">
          <i class="ti ti-circle-check" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Fully graded</div>
        <div class="metric-value green">${gradedCount}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--warning-tint);color:var(--warning)">
          <i class="ti ti-hourglass" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Awaiting TA review</div>
        <div class="metric-value amber">${pendingExams.length}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--info-tint);color:var(--info)">
          <i class="ti ti-users" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Total students graded</div>
        <div class="metric-value">${totalStudents}</div>
      </div>
    </div>

    <div class="grid2">
      <!-- Exams -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Exams</div>
          <button class="btn btn-sm" data-nav="upload">
            <i class="ti ti-plus" aria-hidden="true"></i> Upload Exam
          </button>
        </div>
        ${exams.map(e => examRow(e)).join('')}
        ${exams.length === 0 ? `<div class="empty" style="padding:32px"><p>No exams uploaded yet.</p></div>` : ''}
      </div>

      <!-- Review queue preview -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px">
          <div class="card-title" style="margin:0">
            Awaiting TA Review 
            ${pendingExams.length ? `<span class="badge badge-amber" style="margin-left:6px">${pendingExams.length}</span>` : ''}
          </div>
        </div>
        <div id="pending-ta-list">
          ${pendingExams.length
            ? pendingExams.slice(0, 4).map(e => reviewRow(e)).join('')
            : `<div class="empty" style="padding:24px"><i class="ti ti-check" aria-hidden="true"></i><p>All exams are fully graded</p></div>`}
        </div>
      </div>
    </div>`;

  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
}

function examRow(e) {
  const pct = e.students ? Math.round((e.reviewed || 0) / e.students * 100) : 0;
  return `
    <div class="row-item">
      <div class="row-icon ${e.status === 'graded' ? 'green' : e.status === 'processing' ? 'amber' : 'gray'}">
        <i class="ti ti-file-text" aria-hidden="true"></i>
      </div>
      <div class="row-info">
        <div class="row-name">${e.name}</div>
        <div class="row-meta">${e.students || 'Pending'} students · ${e.uploaded}</div>
        ${e.students ? `<div class="progress" style="margin-top:5px"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}
      </div>
      <span class="badge ${STATUS_BADGE[e.status] ?? 'badge-gray'}">${STATUS_LABEL[e.status] ?? e.status}</span>
    </div>`;
}

function reviewRow(e) {
  return `
    <div class="row-item">
      <div class="row-icon amber">
        <i class="ti ti-hourglass" aria-hidden="true"></i>
      </div>
      <div class="row-info">
        <div class="row-name">${e.name}</div>
        <div class="row-meta">Queued for TA review</div>
      </div>
    </div>`;
}
