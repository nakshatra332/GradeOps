/**
 * pages/upload.js — Upload exam PDF + rubric JSON to the live pipeline.
 *
 * Flow:
 *   1. User drops a PDF and a rubric JSON file.
 *   2. On submit → POST /pipeline/start (FormData with both files).
 *   3. UI switches to a "Processing…" progress card.
 *   4. Poll GET /pipeline/{exam_id} every 2 s.
 *   5. When next_review appears → navigate to ta-review.
 *   6. When is_complete and no next_review → navigate to exams.
 */

import { startPipeline, getPipelineState } from '../api/pipeline.js';
import { createExam } from '../api/exams.js';
import { store }     from '../state.js';
import { navigate }  from '../router.js';
import { showToast } from '../components/toast.js';

let pdfFiles   = [];
let rubricFile = null;
let pollTimer  = null;

const WORKFLOW_STEPS = [
  { title: 'OCR & Transcription', desc: 'Handwriting extracted from scanned pages' },
  { title: 'AI Grading',          desc: 'Answers scored against rubric with justification' },
  { title: 'TA Review',           desc: 'TAs approve, override, or escalate AI scores' },
  { title: 'Export',              desc: 'Final grades saved as gradebook.json' },
];

// ── Render ────────────────────────────────────────────────────────────────────

export async function render(container) {
  pdfFiles   = [];
  rubricFile = null;
  clearInterval(pollTimer);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Upload exam</h1>
        <p class="page-sub">Submit a scanned PDF and a rubric JSON for AI grading + TA review</p>
      </div>
    </div>

    <div class="grid-60-40">
      <!-- Left: file upload + settings -->
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

        </div>

        <!-- PDF drop zone -->
        <div class="card">
          <div class="card-title">
            <i class="ti ti-file-type-pdf" aria-hidden="true"></i> Student PDFs
          </div>
          <div class="upload-zone" id="drop-pdf" role="button" tabindex="0" aria-label="Upload PDF">
            <i class="ti ti-cloud-upload" aria-hidden="true"></i>
            <p id="pdf-label">Drop student PDFs here or click to browse</p>
            <small>Multiple PDFs · One PDF per student</small>
          </div>
          <input type="file" id="file-pdf" accept=".pdf" multiple style="display:none">
        </div>

        <!-- Rubric drop zone -->
        <div class="card">
          <div class="card-title">
            <i class="ti ti-list-check" aria-hidden="true"></i> Rubric / Marking Scheme
          </div>
          <div class="upload-zone" id="drop-rubric" role="button" tabindex="0" aria-label="Upload Rubric JSON or PDF">
            <i class="ti ti-file-code" aria-hidden="true"></i>
            <p id="rubric-label">Drop rubric.json or marking_scheme.pdf here</p>
            <small>JSON must match <strong>RubricSchema</strong>. PDFs will be extracted automatically.</small>
          </div>
          <input type="file" id="file-rubric" accept=".json,.pdf" style="display:none">
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:6px;font-size:var(--text-sm);cursor:pointer">
            <input type="checkbox" id="mock-mode" style="width:16px;height:16px">
            Mock mode <span style="color:var(--neutral-400)">(no API key needed — uses dummy responses)</span>
          </label>
        </div>

        <button class="btn btn-primary" style="width:100%" id="submit-btn">
          <i class="ti ti-send" aria-hidden="true"></i> Submit for grading
        </button>
      </div>

      <!-- Right: workflow steps -->
      <div>
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

        <div class="card" id="api-status-card" style="display:none">
          <div class="card-title">Pipeline status</div>
          <div id="api-status-body"></div>
        </div>
      </div>
    </div>

    <!-- Progress overlay (shown while grading runs) -->
    <div id="progress-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;display:none;align-items:center;justify-content:center">
      <div class="card" style="width:420px;text-align:center;padding:32px">
        <i class="ti ti-loader-2 ti-spin" style="font-size:40px;color:var(--brand);margin-bottom:16px" aria-hidden="true"></i>
        <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:8px" id="progress-title">Starting pipeline…</div>
        <div style="font-size:var(--text-sm);color:var(--neutral-500)" id="progress-sub">This may take a minute. Don't close this tab.</div>
        <div class="progress" style="margin-top:20px"><div class="progress-bar" id="progress-bar" style="width:20%;transition:width 0.8s ease"></div></div>
        <div style="margin-top:8px;font-size:var(--text-xs);color:var(--neutral-400)" id="progress-step">Uploading files…</div>
      </div>
    </div>`;

  bindEvents(container);
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents(container) {
  const dropPdf    = container.querySelector('#drop-pdf');
  const filePdf    = container.querySelector('#file-pdf');
  const dropRubric = container.querySelector('#drop-rubric');
  const fileRubric = container.querySelector('#file-rubric');

  // PDF zone
  dropPdf.addEventListener('click', () => filePdf.click());
  dropPdf.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') filePdf.click(); });
  dropPdf.addEventListener('dragover', e => { e.preventDefault(); dropPdf.classList.add('drag'); });
  dropPdf.addEventListener('dragleave', () => dropPdf.classList.remove('drag'));
  dropPdf.addEventListener('drop', e => {
    e.preventDefault(); dropPdf.classList.remove('drag');
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'));
    if (files.length > 0) setPdf(files, container);
    else showToast('Please drop .pdf files', 'error');
  });
  filePdf.addEventListener('change', () => { if (filePdf.files.length) setPdf(filePdf.files, container); });

  // Rubric zone
  dropRubric.addEventListener('click', () => fileRubric.click());
  dropRubric.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileRubric.click(); });
  dropRubric.addEventListener('dragover', e => { e.preventDefault(); dropRubric.classList.add('drag'); });
  dropRubric.addEventListener('dragleave', () => dropRubric.classList.remove('drag'));
  dropRubric.addEventListener('drop', e => {
    e.preventDefault(); dropRubric.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.json') || f?.name.endsWith('.pdf')) setRubric(f, container);
    else showToast('Please drop a .json or .pdf file', 'error');
  });
  fileRubric.addEventListener('change', () => { if (fileRubric.files[0]) setRubric(fileRubric.files[0], container); });

  container.querySelector('#submit-btn').addEventListener('click', () => handleSubmit(container));
}

function setPdf(files, container) {
  pdfFiles = Array.from(files);
  const size = pdfFiles.reduce((acc, f) => acc + f.size, 0);
  container.querySelector('#pdf-label').textContent = `✓ ${pdfFiles.length} files selected (${(size / 1024 / 1024).toFixed(1)} MB)`;
  container.querySelector('#drop-pdf').style.borderColor = 'var(--brand)';
}

function setRubric(file, container) {
  rubricFile = file;
  container.querySelector('#rubric-label').textContent = `✓ ${file.name}`;
  container.querySelector('#drop-rubric').style.borderColor = 'var(--brand)';
}

// ── Submit & poll ─────────────────────────────────────────────────────────────

async function handleSubmit(container) {
  if (!pdfFiles || pdfFiles.length === 0)    { showToast('Please upload student PDFs first', 'error');      return; }
  if (!rubricFile) { showToast('Please upload a rubric JSON file first', 'error'); return; }

  const mockMode = container.querySelector('#mock-mode')?.checked ?? false;
  const btn      = container.querySelector('#submit-btn');
  btn.disabled   = true;

  showOverlay(container, true);
  setProgress(container, 20, 'Starting pipeline…', 'Uploading files to server…');

  try {
    const { exam_id } = await startPipeline(pdfFiles, rubricFile, null, mockMode);
    store.activeExamId = exam_id;

    const examName = container.querySelector('#exam-name')?.value?.trim() || `Exam ${exam_id.substring(5)}`;
    const examCourse = container.querySelector('#exam-course')?.value?.trim() || 'CS 301';

    await createExam({
      id: exam_id,
      name: examName,
      course: examCourse,
      rubricName: rubricFile.name
    });

    setProgress(container, 40, 'Ingestion complete', 'Splitting PDF into per-student pages…');
    showToast(`Pipeline started — exam ${exam_id}`);

    // Start polling
    let progress = 40;
    const steps  = ['Running OCR on handwritten pages…', 'AI grading in progress…', 'Waiting for TA review…'];
    let stepIdx  = 0;

    pollTimer = setInterval(async () => {
      try {
        const state = await getPipelineState(exam_id);

        progress = Math.min(progress + 8, 85);
        setProgress(container, progress, _statusLabel(state.status), steps[stepIdx % steps.length]);
        stepIdx++;

        if (state.status === 'error') {
          clearInterval(pollTimer);
          showOverlay(container, false);
          showToast(`Pipeline error: ${state.error || 'An unexpected failure occurred on the server.'}`, 'error');
          btn.disabled = false;
          return;
        }

        if (state.next_review) {
          clearInterval(pollTimer);
          setProgress(container, 100, 'Queued for TA review', 'Exam has been processed and is ready for grading.');
          
          // Change the overlay to show a button to go back to exams instead of auto-redirecting
          const overlay = container.querySelector('#progress-overlay');
          const card = overlay.querySelector('.card');
          card.innerHTML = `
            <i class="ti ti-circle-check" style="font-size:48px;color:var(--brand);margin-bottom:16px" aria-hidden="true"></i>
            <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:8px">Exam queued successfully!</div>
            <div style="font-size:var(--text-sm);color:var(--neutral-500);margin-bottom:24px">
              The AI has finished grading. This exam is now waiting in the TA queue for review.
            </div>
            <button class="btn btn-primary" id="btn-back-exams" style="width:100%;justify-content:center">
              Back to Exams
            </button>
          `;
          card.querySelector('#btn-back-exams').addEventListener('click', () => {
            showOverlay(container, false);
            navigate('exams');
          });
          return;
        }

        if (state.is_complete) {
          clearInterval(pollTimer);
          setProgress(container, 100, 'Grading complete!', 'Navigating to exams…');
          setTimeout(() => { showOverlay(container, false); navigate('exams'); }, 800);
        }
      } catch (err) {
        console.warn('[upload] Poll error:', err);
      }
    }, 2500);

  } catch (err) {
    showOverlay(container, false);
    showToast(err.message ?? 'Submission failed', 'error');
    btn.disabled = false;
  }
}

function showOverlay(container, show) {
  const el = container.querySelector('#progress-overlay') ?? document.getElementById('progress-overlay');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function setProgress(container, pct, title, sub) {
  const bar   = container.querySelector('#progress-bar')   ?? document.getElementById('progress-bar');
  const titleEl = container.querySelector('#progress-title') ?? document.getElementById('progress-title');
  const subEl   = container.querySelector('#progress-sub')   ?? document.getElementById('progress-sub');
  const stepEl  = container.querySelector('#progress-step')  ?? document.getElementById('progress-step');
  if (bar)    bar.style.width = `${pct}%`;
  if (titleEl) titleEl.textContent = title;
  if (stepEl)  stepEl.textContent  = sub;
}

function _statusLabel(status) {
  return { processing: 'Grading in progress…', awaiting_review: 'Awaiting TA review', complete: 'Complete!', error: 'Error' }[status] ?? status;
}
