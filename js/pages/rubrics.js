/**
 * pages/rubrics.js — Define and manage grading rubrics.
 */

import { getRubrics, saveRubric, deleteRubric } from '../api/rubrics.js';
import { showToast } from '../components/toast.js';

const SAMPLE_JSON = `{
  "exam": "Midterm",
  "questions": [
    {
      "id": "q1",
      "text": "Explain QuickSort time complexity",
      "marks": 10,
      "criteria": [
        "Correct average case O(n log n)",
        "Worst case O(n²) mentioned",
        "Partition step explained"
      ]
    }
  ]
}`;

export async function render(container) {
  const rubrics = await getRubrics();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Rubrics</h1>
        <p class="page-sub">${rubrics.length} rubric${rubrics.length !== 1 ? 's' : ''} on file</p>
      </div>
    </div>

    <div class="grid2">
      <!-- Existing rubrics -->
      <div class="card" style="${rubrics.length ? 'padding:0;overflow:hidden' : ''}">
        <div style="padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Saved rubrics</div>
        </div>
        ${rubrics.length
          ? rubrics.map(r => rubricRow(r)).join('')
          : `<div class="empty"><i class="ti ti-braces-off" aria-hidden="true"></i><p>No rubrics yet</p><small>Add one using the form →</small></div>`}
      </div>

      <!-- New rubric form -->
      <div class="card">
        <div class="card-title">Add rubric</div>
        <div class="form-group">
          <label class="form-label" for="rubric-name">Name</label>
          <input type="text" id="rubric-name" placeholder="e.g. quiz4_rubric.json">
        </div>
        <div class="form-group">
          <label class="form-label" for="rubric-json">JSON definition</label>
          <textarea id="rubric-json" rows="14" placeholder="${SAMPLE_JSON.replace(/"/g, '&quot;')}"></textarea>
          <div class="form-hint">Question count and total marks are parsed from the JSON automatically.</div>
        </div>
        <button class="btn btn-primary" style="width:100%" id="save-rubric-btn">
          Save rubric
        </button>
      </div>
    </div>`;

  bindEvents(container);
}

function bindEvents(container) {
  container.querySelector('#save-rubric-btn').addEventListener('click', async () => {
    const name    = container.querySelector('#rubric-name')?.value?.trim();
    const jsonTxt = container.querySelector('#rubric-json')?.value?.trim();
    if (!name) { showToast('Enter a rubric name', 'error'); return; }
    try { if (jsonTxt) JSON.parse(jsonTxt); } catch {
      showToast('Invalid JSON — check the definition', 'error'); return;
    }
    const btn = container.querySelector('#save-rubric-btn');
    btn.disabled = true;
    try {
      await saveRubric({ name, jsonText: jsonTxt });
      showToast('Rubric saved');
      render(container);
    } catch {
      showToast('Failed to save rubric', 'error');
      btn.disabled = false;
    }
  });

  container.querySelectorAll('[data-delete-rubric]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteRubric(Number(btn.dataset.deleteRubric));
      showToast('Rubric deleted');
      render(container);
    });
  });
}

function rubricRow(r) {
  return `
    <div class="row-item">
      <div class="row-icon green"><i class="ti ti-braces" aria-hidden="true"></i></div>
      <div class="row-info">
        <div class="row-name">${r.name}</div>
        <div class="row-meta">${r.questions} questions · ${r.totalMarks} pts · ${r.created}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-sm btn-icon btn-danger" data-delete-rubric="${r.id}" title="Delete">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}
