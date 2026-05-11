/**
 * pages/dashboard.js — Instructor overview dashboard.
 */

import { getExams } from '../api/exams.js';
import { getRubrics } from '../api/rubrics.js';
import { getReviewStats } from '../api/reviews.js';
import { navigate } from '../router.js';

const STATUS_BADGE = {
  graded:     'badge-green',
  processing: 'badge-amber',
  pending:    'badge-gray',
};

const STATUS_LABEL = { graded: 'Graded', processing: 'In progress', pending: 'Not started' };

export async function render(container) {
  const [exams, rubrics, stats] = await Promise.all([getExams(), getRubrics(), getReviewStats()]);
  const totalStudents = exams.reduce((s, e) => s + e.students, 0);
  const gradedCount   = exams.filter(e => e.status === 'graded').length;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Overview</h1>
        <p class="page-sub">CS 301 — Algorithms · grading activity at a glance</p>
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
        <div class="metric-label">Awaiting review</div>
        <div class="metric-value amber">${stats.pending}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--info-tint);color:var(--info)">
          <i class="ti ti-users" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Total students</div>
        <div class="metric-value">${totalStudents}</div>
      </div>
    </div>

    <div class="grid2">
      <!-- Exams -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Exams</div>
          <button class="btn btn-sm" data-nav="upload">
            <i class="ti ti-plus" aria-hidden="true"></i> New
          </button>
        </div>
        ${exams.map(e => examRow(e)).join('')}
        ${exams.length === 0 ? `<div class="empty"><p>No exams uploaded yet.</p></div>` : ''}
      </div>

      <!-- Review queue -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Needs review <span id="pending-count-badge"></span></div>
          <button class="btn btn-sm" data-nav="ta-review">View queue</button>
        </div>
        <div id="pending-ta-list">
          ${skeletonRows(3)}
        </div>
      </div>
    </div>

    <!-- Rubrics summary -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px">
        <div class="card-title" style="margin:0">Rubrics</div>
        <button class="btn btn-sm" data-nav="rubrics">Manage</button>
      </div>
      <table>
        <thead>
          <tr><th>Name</th><th>Questions</th><th>Total marks</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          ${rubrics.length
            ? rubrics.map(r => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="row-icon blue" style="width:28px;height:28px;font-size:13px;border-radius:6px">
                      <i class="ti ti-braces" aria-hidden="true"></i>
                    </div>
                    <span style="font-weight:500">${r.name}</span>
                  </div>
                </td>
                <td>${r.questions}</td>
                <td>${r.totalMarks} pts</td>
                <td style="color:var(--neutral-400)">${r.created}</td>
                <td><button class="btn btn-sm" data-nav="rubrics">View</button></td>
              </tr>`).join('')
            : `<tr><td colspan="5"><div class="empty" style="padding:24px"><p>No rubrics yet</p></div></td></tr>`}
        </tbody>
      </table>
    </div>`;

  // Async: load pending reviews into the card
  const { getPendingReviews } = await import('../api/reviews.js');
  const pending = await getPendingReviews();
  const listEl  = container.querySelector('#pending-ta-list');
  const badgeEl = container.querySelector('#pending-count-badge');

  if (badgeEl && pending.length) {
    badgeEl.innerHTML = `<span class="badge badge-amber" style="margin-left:6px">${pending.length}</span>`;
  }

  if (listEl) {
    listEl.innerHTML = pending.length
      ? pending.slice(0, 4).map(r => reviewRow(r)).join('')
      : `<div class="empty" style="padding:24px"><i class="ti ti-check" aria-hidden="true"></i><p>All caught up</p></div>`;
  }

  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
}

function examRow(e) {
  const pct = e.students ? Math.round(e.reviewed / e.students * 100) : 0;
  return `
    <div class="row-item">
      <div class="row-icon ${e.status === 'graded' ? 'green' : e.status === 'processing' ? 'amber' : 'gray'}">
        <i class="ti ti-file-text" aria-hidden="true"></i>
      </div>
      <div class="row-info">
        <div class="row-name">${e.name}</div>
        <div class="row-meta">${e.students} students · ${e.uploaded}</div>
        ${e.students ? `<div class="progress" style="margin-top:5px"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}
      </div>
      <span class="badge ${STATUS_BADGE[e.status] ?? 'badge-gray'}">${STATUS_LABEL[e.status] ?? e.status}</span>
    </div>`;
}

function reviewRow(r) {
  const confBadge = { high: 'badge-green', low: 'badge-red', medium: 'badge-amber' };
  return `
    <div class="row-item" data-nav="ta-review" style="cursor:pointer">
      <div class="row-icon amber">
        <i class="ti ti-eye" aria-hidden="true"></i>
      </div>
      <div class="row-info">
        <div class="row-name">${r.student} — ${r.q.substring(0, 36)}…</div>
        <div class="row-meta">Score: ${r.ai_score}/${r.max}</div>
      </div>
      <span class="badge ${confBadge[r.confidence] ?? 'badge-gray'}">${r.confidence}</span>
    </div>`;
}

function skeletonRows(n) {
  return Array.from({ length: n }, () => `
    <div class="row-item">
      <div class="skeleton" style="width:34px;height:34px;border-radius:8px;flex-shrink:0"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px">
        <div class="skeleton" style="height:13px;width:55%"></div>
        <div class="skeleton" style="height:11px;width:35%"></div>
      </div>
    </div>`).join('');
}
