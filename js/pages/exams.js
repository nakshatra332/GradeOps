/**
 * pages/exams.js — Manage all uploaded exam batches.
 */

import { getExams, deleteExam } from '../api/exams.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

const STATUS_BADGE = { graded: 'badge-green', processing: 'badge-amber', pending: 'badge-gray' };
const STATUS_LABEL = { graded: 'Graded', processing: 'In progress', pending: 'Pending' };

export async function render(container) {
  const exams = await getExams();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Exams</h1>
        <p class="page-sub">${exams.length} batch${exams.length !== 1 ? 'es' : ''} uploaded</p>
      </div>
      <button class="btn btn-primary" id="btn-upload-new">
        <i class="ti ti-upload" aria-hidden="true"></i> Upload exam
      </button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Exam</th>
            <th>Students</th>
            <th style="min-width:120px">TA progress</th>
            <th>Rubric</th>
            <th>Status</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${exams.length
            ? exams.map(e => examRow(e)).join('')
            : `<tr><td colspan="7"><div class="empty"><i class="ti ti-files" aria-hidden="true"></i><p>No exams yet</p><small>Upload your first exam to get started.</small></div></td></tr>`}
        </tbody>
      </table>
    </div>`;

  container.querySelector('#btn-upload-new').addEventListener('click', () => navigate('upload'));

  container.querySelectorAll('[data-delete-exam]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this exam? This cannot be undone.')) return;
      await deleteExam(Number(btn.dataset.deleteExam));
      showToast('Exam removed');
      render(container);
    });
  });
}

function examRow(e) {
  const pct    = e.students ? Math.round(e.reviewed / e.students * 100) : 0;
  const rubric = e.rubric
    ? `<span class="badge badge-blue" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.rubric}</span>`
    : `<span style="font-size:var(--text-xs);color:var(--neutral-400)">—</span>`;

  return `
    <tr>
      <td>
        <div style="font-weight:500;color:var(--neutral-900)">${e.name}</div>
        <div style="font-size:var(--text-xs);color:var(--neutral-400);margin-top:1px">${e.course}</div>
      </td>
      <td>${e.students}</td>
      <td>
        <div style="font-size:var(--text-xs);color:var(--neutral-600);margin-bottom:5px">${e.reviewed} / ${e.students}</div>
        <div class="progress" style="width:90px"><div class="progress-bar" style="width:${pct}%"></div></div>
      </td>
      <td>${rubric}</td>
      <td><span class="badge ${STATUS_BADGE[e.status] ?? 'badge-gray'}">${STATUS_LABEL[e.status] ?? e.status}</span></td>
      <td style="color:var(--neutral-400);font-size:var(--text-xs)">${e.uploaded}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-icon" title="Download grades"><i class="ti ti-download" aria-hidden="true"></i></button>
          <button class="btn btn-sm btn-icon btn-danger" data-delete-exam="${e.id}" title="Remove exam"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}
