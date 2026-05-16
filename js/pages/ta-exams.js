/**
 * pages/ta-exams.js — Read-only view of all exams for TAs.
 */

import { getExams } from '../api/exams.js';

const STATUS_BADGE = { graded: 'badge-green', processing: 'badge-amber', pending: 'badge-gray' };
const STATUS_LABEL = { graded: 'Graded', processing: 'In progress', pending: 'Pending' };

export async function render(container) {
  const exams = await getExams();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Exams</h1>
        <p class="page-sub">Read-only — contact your instructor to make changes</p>
      </div>
    </div>

    ${exams.map(e => {
      const pct = e.students ? Math.round(e.reviewed / e.students * 100) : 0;
      return `
        <div class="card">
          <div style="display:flex;align-items:center;gap:14px">
            <div class="row-icon ${e.status === 'graded' ? 'green' : e.status === 'processing' ? 'amber' : 'gray'}" style="width:40px;height:40px;font-size:18px;flex-shrink:0">
              <i class="ti ti-file-text" aria-hidden="true"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:var(--text-md)">${e.name}</div>
              <div style="font-size:var(--text-xs);color:var(--neutral-400);margin-top:2px">
                ${e.students} students · ${e.uploaded}${e.rubric ? ` · ${e.rubric}` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
                <div class="progress" style="width:160px">
                  <div class="progress-bar" style="width:${pct}%"></div>
                </div>
                <span style="font-size:var(--text-xs);color:var(--neutral-400)">${pct}% reviewed</span>
              </div>
            </div>
            <span class="badge ${STATUS_BADGE[e.status] ?? 'badge-gray'}">${STATUS_LABEL[e.status] ?? e.status}</span>
          </div>
        </div>`;
    }).join('')}`;
}
