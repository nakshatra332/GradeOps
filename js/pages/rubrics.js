/**
 * pages/rubrics.js — Define and manage grading rubrics.
 */

import { getRubrics, saveRubric, deleteRubric } from '../api/rubrics.js';
import { getCourses } from '../api/courses.js';
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

let courses = [];
export async function render(container) {
  let rubrics = [];
  try {
    [rubrics, courses] = await Promise.all([getRubrics(), getCourses()]);
  } catch (err) {
    console.warn('Metadata fetch failed:', err);
  }

  // Filter rubrics for active course if one is selected
  const activeCourse = courses.find(c => c.id === store.selectedCourseId);
  const filteredRubrics = store.selectedCourseId 
    ? rubrics.filter(r => r.course_id === store.selectedCourseId || !r.course_id)
    : rubrics;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Rubrics</h1>
        <p class="page-sub">
          ${activeCourse ? `Viewing rubrics for <strong>${activeCourse.code}</strong>` : 'All rubrics on file'}
        </p>
      </div>
    </div>

    <div class="grid2">
      <!-- Existing rubrics -->
      <div class="card" style="${filteredRubrics.length ? 'padding:0;overflow:hidden' : ''}">
        <div style="padding:16px 18px 14px; display:flex; justify-content:space-between; align-items:center">
          <div class="card-title" style="margin:0">Saved rubrics</div>
          ${store.selectedCourseId ? `<button class="btn btn-sm" id="btn-show-all">Show all</button>` : ''}
        </div>
        ${filteredRubrics.length
          ? filteredRubrics.map(r => rubricRow(r)).join('')
          : `<div class="empty"><i class="ti ti-braces-off" aria-hidden="true"></i><p>No rubrics for this course</p><small>Add one using the form →</small></div>`}
      </div>
...
function bindEvents(container) {
  container.querySelector('#btn-show-all')?.addEventListener('click', () => {
    store.selectedCourseId = null;
    render(container);
  });
...

      <div class="card">
        <div class="card-title">Add rubric</div>
        <div class="form-group">
          <label class="form-label" for="rubric-name">Name</label>
          <input type="text" id="rubric-name" placeholder="e.g. quiz4_rubric.json">
        </div>
        <div class="form-group">
          <label class="form-label" for="rubric-course">Course (optional)</label>
          <select id="rubric-course">
            <option value="">-- None --</option>
            ${courses.map(c => `<option value="${c.id}" ${store.selectedCourseId === c.id ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join('')}
          </select>
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
    const name     = container.querySelector('#rubric-name')?.value?.trim();
    const jsonTxt  = container.querySelector('#rubric-json')?.value?.trim();
    const courseId = container.querySelector('#rubric-course')?.value;

    if (!name) { showToast('Enter a rubric name', 'error'); return; }
    try { if (jsonTxt) JSON.parse(jsonTxt); } catch {
      showToast('Invalid JSON — check the definition', 'error'); return;
    }
    const btn = container.querySelector('#save-rubric-btn');
    btn.disabled = true;
    try {
      await saveRubric({ name, jsonText: jsonTxt, course_id: courseId });
      showToast('Rubric saved');
      render(container);
    } catch (err) {
      showToast(err.message || 'Failed to save rubric', 'error');
      btn.disabled = false;
    }
  });

  container.querySelectorAll('[data-delete-rubric]').forEach(btn => {
    btn.addEventListener('click', async () => {
      // Backend delete not implemented, but we clear from view
      showToast('Deletion not yet implemented on backend');
    });
  });
}

function rubricRow(r) {
  const course = courses.find(c => c.id === r.course_id);
  const courseTag = course ? `<span class="badge badge-gray" style="margin-left:6px">${course.code}</span>` : '';

  return `
    <div class="row-item">
      <div class="row-icon green"><i class="ti ti-braces" aria-hidden="true"></i></div>
      <div class="row-info">
        <div class="row-name">${r.name}${courseTag}</div>
        <div class="row-meta">${r.questions} questions · ${r.total_marks} pts · ${r.created_at}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-sm btn-icon btn-danger" data-delete-rubric="${r.id}" title="Delete">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}
