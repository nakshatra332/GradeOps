/**
 * pages/ta-dashboard.js — TA overview and quick queue preview.
 */

import { getReviewStats, getPendingReviews } from '../api/reviews.js';
import { navigate } from '../router.js';

export async function render(container) {
  const [stats, pending] = await Promise.all([getReviewStats(), getPendingReviews()]);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Your queue</h1>
        <p class="page-sub">${stats.pending > 0 ? `${stats.pending} item${stats.pending !== 1 ? 's' : ''} need your attention` : 'All caught up!'}</p>
      </div>
      ${stats.pending > 0 ? `
        <button class="btn btn-primary" id="start-reviewing">
          <i class="ti ti-arrow-right" aria-hidden="true"></i> Start reviewing
        </button>` : ''}
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-icon" style="background:var(--warning-tint);color:var(--warning)">
          <i class="ti ti-hourglass" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Pending</div>
        <div class="metric-value amber">${stats.pending}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--brand-tint);color:var(--brand-dark)">
          <i class="ti ti-circle-check" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Approved</div>
        <div class="metric-value green">${stats.approved}</div>
      </div>
      <div class="metric">
        <div class="metric-icon" style="background:var(--neutral-100);color:var(--neutral-600)">
          <i class="ti ti-edit" aria-hidden="true"></i>
        </div>
        <div class="metric-label">Overridden</div>
        <div class="metric-value">${stats.overridden}</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 18px 14px">
        <div class="card-title" style="margin:0">Up next</div>
      </div>
      ${pending.length
        ? pending.slice(0, 5).map(r => queueRow(r)).join('')
        : `<div class="empty"><i class="ti ti-circle-check" aria-hidden="true"></i><p>Nothing to review right now</p></div>`}
    </div>`;

  container.querySelector('#start-reviewing')?.addEventListener('click', () => navigate('ta-review'));
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
}

const CONF_BADGE = { high: 'badge-green', low: 'badge-red', medium: 'badge-amber' };
const CONF_LABEL = { high: 'High', low: 'Low', medium: 'Medium' };

function queueRow(r) {
  return `
    <div class="row-item" data-nav="ta-review" style="cursor:pointer">
      <div class="row-icon amber"><i class="ti ti-file-pencil" aria-hidden="true"></i></div>
      <div class="row-info">
        <div class="row-name">${r.student} · ${r.exam}</div>
        <div class="row-meta">${r.q} · AI: ${r.ai_score}/${r.max}</div>
      </div>
      <span class="badge ${CONF_BADGE[r.confidence] ?? 'badge-gray'}">${CONF_LABEL[r.confidence] ?? r.confidence} confidence</span>
    </div>`;
}
