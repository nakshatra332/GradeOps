/**
 * pages/ta-dashboard.js — TA overview and quick queue preview.
 */

import { store } from '../state.js';
import { getExams } from '../api/exams.js';
import { navigate } from '../router.js';

export async function render(container) {
  const exams = await getExams();
  const pendingExams = exams.filter(e => e.status === 'processing');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Your queue</h1>
        <p class="page-sub">${pendingExams.length > 0 ? `${pendingExams.length} exam${pendingExams.length !== 1 ? 's' : ''} awaiting your review` : 'All caught up!'}</p>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 18px 14px">
        <div class="card-title" style="margin:0">Exams to review</div>
      </div>
      ${pendingExams.length
        ? pendingExams.map(e => queueRow(e)).join('')
        : `<div class="empty" style="padding:40px"><i class="ti ti-circle-check" aria-hidden="true" style="font-size:36px;color:var(--brand);margin-bottom:16px"></i><p>Nothing to review right now</p></div>`}
    </div>`;

  container.querySelectorAll('[data-exam-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.activeExamId = btn.dataset.examId;
      navigate('ta-review');
    });
  });
}

function queueRow(e) {
  return `
    <div class="row-item">
      <div class="row-icon amber"><i class="ti ti-file-text" aria-hidden="true"></i></div>
      <div class="row-info">
        <div class="row-name">${e.name}</div>
        <div class="row-meta">${e.course} · Uploaded: ${e.uploaded}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-exam-id="${e.id}">
        <i class="ti ti-player-play" aria-hidden="true"></i> Start Review
      </button>
    </div>`;
}
