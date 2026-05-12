/**
 * api/pipeline.js — All communication with the FastAPI grading pipeline.
 *
 * Base URL is http://localhost:8000 — the FastAPI server.
 * The frontend (served on port 3000) calls these functions; CORS is
 * pre-configured on the backend to allow this.
 */

const API_BASE = 'http://localhost:8000';

/**
 * Start the grading pipeline for an exam.
 *
 * @param {File}   pdfFile     - The uploaded PDF file object
 * @param {File}   rubricFile  - The rubric JSON file object
 * @param {string} examId      - Optional custom exam ID
 * @param {boolean} mock       - Use mock LLM (no API key needed)
 * @returns {{ exam_id: string, status: string }}
 */
export async function startPipeline(pdfFile, rubricFile, examId = null, mock = false) {
  const form = new FormData();
  form.append('pdf',    pdfFile);
  form.append('rubric', rubricFile);
  if (examId) form.append('exam_id', examId);
  form.append('mock', String(mock));

  const res = await fetch(`${API_BASE}/pipeline/start`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to start pipeline');
  }

  return res.json(); // { exam_id, status }
}

/**
 * Poll the pipeline state for an exam.
 * Call this every 2–3 seconds while status === "processing".
 *
 * @param {string} examId
 * @returns {{
 *   exam_id:     string,
 *   status:      string,      // "processing" | "awaiting_review" | "complete" | "error"
 *   students:    object[],
 *   stats:       object,
 *   next_review: object|null, // the interrupt payload for the current student
 *   is_complete: boolean,
 *   error:       string|null
 * }}
 */
export async function getPipelineState(examId) {
  const res = await fetch(`${API_BASE}/pipeline/${examId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to fetch pipeline state');
  }
  return res.json();
}

/**
 * Submit a TA decision (approve / override / escalate) for the current student.
 * This resumes the paused LangGraph pipeline.
 *
 * @param {string} examId
 * @param {'approve'|'override'|'escalate'} action
 * @param {number|null} score    - Required when action === 'override'
 * @param {string}      comment  - Optional override comment
 * @returns {{ exam_id, is_complete, next_review, stats }}
 */
export async function submitDecision(examId, action, score = null, comment = '') {
  const res = await fetch(`${API_BASE}/review/${examId}/decide`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, score, comment }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to submit decision');
  }

  return res.json();
}
