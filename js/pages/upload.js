/**
 * pages/upload.js — Upload exam PDFs and attach a rubric.
 */

import { getRubrics } from '../api/rubrics.js';
import { createExam } from '../api/exams.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

let uploadedFiles = [];

const WORKFLOW_STEPS = [
  { title: 'OCR & Transcription', desc: 'Handwriting is extracted per question' },
  { title: 'AI grading',          desc: 'Answers scored against your rubric with reasoning' },
  { title: 'TA review',           desc: 'TAs approve or override AI scores' },
  { title: 'Export',              desc: 'Final grades exported to CSV' },
];

export async function render(container) {
  uploadedFiles = [];
  const rubrics = await getRubrics();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Upload exam</h1>
        <p class="page-sub">Submit scanned PDFs for AI grading and TA review</p>
      </div>
    </div>

    <div class="grid-60-40">
      <!-- Left: details + file drop -->
      <div>
        <div class="card">
          <div class="card-title">Exam details</div>
          <div class="form-group">
            <label class="form-label" for="exam-name">Exam name</label>
            <input type="text" id="exam-name" placeholder="e.g. Midterm Exam — Section B">
          </div>
          <div class="form-group">
            <label class="form-label" for="exam-course">Course code</label>
            <input type="text" id="exam-course" value="CS 301">
          </div>
          <div class="form-group">
            <label class="form-label" for="rubric-select">Grading rubric</label>
            <select id="rubric-select">
              <option value="">No rubric — manual grading only</option>
              ${rubrics.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
              <option value="new">+ Paste new rubric JSON…</option>
            </select>
          </div>
          <div id="new-rubric-zone" style="display:none">
            <div class="form-group">
              <label class="form-label" for="inline-rubric-json">Rubric JSON</label>
              <textarea id="inline-rubric-json" rows="7"
                placeholder='{"questions":[{"id":"q1","text":"Explain QuickSort","marks":10,"criteria":["Correct recurrence","Partition logic"]}]}'></textarea>
              <div class="form-hint">Paste valid JSON. Questions and marks are parsed automatically.</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">PDF files</div>
          <div class="upload-zone" id="drop-zone" role="button" tabindex="0" aria-label="Upload PDFs">
            <i class="ti ti-cloud-upload" aria-hidden="true"></i>
            <p>Drop PDFs here or click to browse</p>
            <small>Multiple files allowed · max 200 MB each</small>
          </div>
          <input type="file" id="file-in" multiple accept=".pdf" style="display:none">
          <div id="file-list" style="margin-top:10px"></div>
        </div>

        <button class="btn btn-primary" style="width:100%" id="submit-btn">
          <i class="ti ti-send" aria-hidden="true"></i> Submit for grading
        </button>
      </div>

      <!-- Right: settings + what happens next -->
      <div>
        <div class="card">
          <div class="card-title">Settings</div>
          <div class="form-group">
            <label class="form-label" for="pages-per-student">Pages per student</label>
            <input type="text" id="pages-per-student" placeholder="e.g. 4">
          </div>
          <div class="form-group">
            <label class="form-label" for="grading-mode">Grading mode</label>
            <select id="grading-mode">
              <option value="auto">AI + TA review</option>
              <option value="manual">Manual only</option>
            </select>
          </div>
        </div>

        <div class="card">
          <div class="card-title">What happens after upload</div>
          <div class="step-list">
            ${WORKFLOW_STEPS.map((s, i) => `
              <div class="step">
                <div class="step-num">${i + 1}</div>
                <div>
                  <div class="step-title">${s.title}</div>
                  <div class="step-desc">${s.desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  bindUploadEvents(container);
}

function bindUploadEvents(container) {
  const dropZone  = container.querySelector('#drop-zone');
  const fileInput = container.querySelector('#file-in');
  const rubricSel = container.querySelector('#rubric-select');
  const newZone   = container.querySelector('#new-rubric-zone');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    addFiles(e.dataTransfer.files, container);
  });

  fileInput.addEventListener('change', () => addFiles(fileInput.files, container));
  rubricSel.addEventListener('change', () => {
    newZone.style.display = rubricSel.value === 'new' ? 'block' : 'none';
  });

  container.querySelector('#submit-btn').addEventListener('click', () => handleSubmit(container));
}

function addFiles(files, container) {
  for (const f of files) {
    if (!uploadedFiles.find(x => x.name === f.name)) uploadedFiles.push({ name: f.name, size: f.size });
  }
  renderFileList(container);
}

function renderFileList(container) {
  const listEl = container.querySelector('#file-list');
  if (!listEl) return;
  listEl.innerHTML = uploadedFiles.map((f, i) => `
    <div class="row-item" style="border:1px solid var(--neutral-200);border-radius:var(--radius-md);margin-bottom:6px">
      <div class="row-icon blue"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>
      <div class="row-info">
        <div class="row-name">${f.name}</div>
        <div class="row-meta">${(f.size / 1024 / 1024).toFixed(1)} MB</div>
      </div>
      <button class="btn btn-sm btn-icon" data-remove="${i}" aria-label="Remove ${f.name}">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>`).join('');

  listEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadedFiles.splice(Number(btn.dataset.remove), 1);
      renderFileList(container);
    });
  });
}

async function handleSubmit(container) {
  const name     = container.querySelector('#exam-name')?.value?.trim();
  const course   = container.querySelector('#exam-course')?.value?.trim() || 'CS 301';
  const rubricId = Number(container.querySelector('#rubric-select')?.value) || null;

  if (!name) { showToast('Enter an exam name first', 'error'); return; }

  const btn = container.querySelector('#submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 ti-spin" aria-hidden="true"></i> Submitting…';

  try {
    await createExam({ name, course, rubricId });
    uploadedFiles = [];
    showToast('Exam submitted — processing will begin shortly');
    navigate('exams');
  } catch {
    showToast('Submission failed. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send" aria-hidden="true"></i> Submit for grading';
  }
}
