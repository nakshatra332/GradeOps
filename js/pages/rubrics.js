/**
 * pages/rubrics.js — Define and manage grading rubrics.
 */

import { getRubrics, saveRubric, deleteRubric } from '../api/rubrics.js';
<<<<<<< HEAD
=======
import { getCourses } from '../api/courses.js';
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
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

<<<<<<< HEAD
export async function render(container) {
  const rubrics = await getRubrics();
=======
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
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Rubrics</h1>
<<<<<<< HEAD
        <p class="page-sub">${rubrics.length} rubric${rubrics.length !== 1 ? 's' : ''} on file</p>
=======
        <p class="page-sub">
          ${activeCourse ? `Viewing rubrics for <strong>${activeCourse.code}</strong>` : 'All rubrics on file'}
        </p>
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
      </div>
    </div>

    <div class="grid2">
      <!-- Existing rubrics -->
<<<<<<< HEAD
      <div class="card" style="${rubrics.length ? 'padding:0;overflow:hidden' : ''}">
        <div style="padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Saved rubrics</div>
        </div>
        ${rubrics.length
          ? rubrics.map(r => rubricRow(r)).join('')
          : `<div class="empty"><i class="ti ti-braces-off" aria-hidden="true"></i><p>No rubrics yet</p><small>Add one using the form →</small></div>`}
      </div>

      <!-- New rubric form -->
=======
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

>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
      <div class="card">
        <div class="card-title">Add rubric</div>
        <div class="form-group">
          <label class="form-label" for="rubric-name">Name</label>
          <input type="text" id="rubric-name" placeholder="e.g. quiz4_rubric.json">
        </div>
        <div class="form-group">
<<<<<<< HEAD
=======
          <label class="form-label" for="rubric-course">Course (optional)</label>
          <select id="rubric-course">
            <option value="">-- None --</option>
            ${courses.map(c => `<option value="${c.id}" ${store.selectedCourseId === c.id ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
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
<<<<<<< HEAD
    const name    = container.querySelector('#rubric-name')?.value?.trim();
    const jsonTxt = container.querySelector('#rubric-json')?.value?.trim();
=======
    const name     = container.querySelector('#rubric-name')?.value?.trim();
    const jsonTxt  = container.querySelector('#rubric-json')?.value?.trim();
    const courseId = container.querySelector('#rubric-course')?.value;

>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    if (!name) { showToast('Enter a rubric name', 'error'); return; }
    try { if (jsonTxt) JSON.parse(jsonTxt); } catch {
      showToast('Invalid JSON — check the definition', 'error'); return;
    }
    const btn = container.querySelector('#save-rubric-btn');
    btn.disabled = true;
    try {
<<<<<<< HEAD
      await saveRubric({ name, jsonText: jsonTxt });
      showToast('Rubric saved');
      render(container);
    } catch {
      showToast('Failed to save rubric', 'error');
=======
      await saveRubric({ name, jsonText: jsonTxt, course_id: courseId });
      showToast('Rubric saved');
      render(container);
    } catch (err) {
      showToast(err.message || 'Failed to save rubric', 'error');
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
      btn.disabled = false;
    }
  });

  container.querySelectorAll('[data-delete-rubric]').forEach(btn => {
    btn.addEventListener('click', async () => {
<<<<<<< HEAD
      await deleteRubric(Number(btn.dataset.deleteRubric));
      showToast('Rubric deleted');
      render(container);
=======
      // Backend delete not implemented, but we clear from view
      showToast('Deletion not yet implemented on backend');
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    });
  });
}

function rubricRow(r) {
<<<<<<< HEAD
=======
  const course = courses.find(c => c.id === r.course_id);
  const courseTag = course ? `<span class="badge badge-gray" style="margin-left:6px">${course.code}</span>` : '';

>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
  return `
    <div class="row-item">
      <div class="row-icon green"><i class="ti ti-braces" aria-hidden="true"></i></div>
      <div class="row-info">
<<<<<<< HEAD
        <div class="row-name">${r.name}</div>
        <div class="row-meta">${r.questions} questions · ${r.totalMarks} pts · ${r.created}</div>
=======
        <div class="row-name">${r.name}${courseTag}</div>
        <div class="row-meta">${r.questions} questions · ${r.total_marks} pts · ${r.created_at}</div>
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
      </div>
      <div class="row-actions">
        <button class="btn btn-sm btn-icon btn-danger" data-delete-rubric="${r.id}" title="Delete">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}
