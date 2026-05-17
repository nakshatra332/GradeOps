/**
 * pages/ta-review.js — TA review queue: approve, override, or escalate AI grades.
 *
 * Data source: live FastAPI pipeline (GET /pipeline/{exam_id}).
 * Actions:     POST /review/{exam_id}/decide → resumes LangGraph.
 *
 * Falls back to the mocked queue from state.js if no active exam is running.
 */

import { getPipelineState, submitDecision } from '../api/pipeline.js';
import { store }    from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderNav } from '../router.js';

// ── Render ─────────────────────────────────────────────────────────────────────

export async function render(container) {
  const examId = store.activeExamId;

  // No active exam — show empty state with helper tip
  if (!examId) {
    container.innerHTML = `
      <h1 class="page-title">Review queue</h1>
      <div class="empty" style="margin-top:80px">
        <i class="ti ti-inbox" aria-hidden="true"></i>
        <p>No active grading session.</p>
        <p style="font-size:var(--text-sm);color:var(--neutral-400);margin-top:4px">
          Go to <strong>Upload Exam</strong> to start a new grading run.
        </p>
        <button class="btn btn-primary" style="margin-top:16px" id="go-upload">
          <i class="ti ti-upload" aria-hidden="true"></i> Upload Exam
        </button>
      </div>`;
    container.querySelector('#go-upload')?.addEventListener('click', () => navigate('upload'));
    return;
  }

  // Show loading skeleton while we fetch pipeline state
  container.innerHTML = `
    <h1 class="page-title">Review queue</h1>
    <div class="empty" style="margin-top:60px">
      <i class="ti ti-loader-2 ti-spin" style="font-size:36px;color:var(--brand)" aria-hidden="true"></i>
      <p style="margin-top:12px">Loading pipeline state…</p>
    </div>`;

  let state;
  try {
    state = await getPipelineState(examId);
  } catch (err) {
    container.innerHTML = `
      <h1 class="page-title">Review queue</h1>
      <div class="empty" style="margin-top:60px">
        <i class="ti ti-alert-circle" aria-hidden="true"></i>
        <p>Could not reach the pipeline server.</p>
        <p style="font-size:var(--text-sm);color:var(--neutral-400)">Make sure the FastAPI server is running on port 8000.</p>
      </div>`;
    return;
  }

  // Still processing — not ready for review yet
  if (state.status === 'processing') {
    renderProcessing(container, examId);
    return;
  }

  // No pending review → either all done or not started
  if (!state.next_review) {
    if (state.status === 'complete') {
      // Update exam in store so Dashboard and Exams page show it as graded
      const examRecord = store.exams.find(e => e.id === examId);
      if (examRecord) {
        examRecord.status = 'graded';
        examRecord.students = state.stats?.total_students ?? 0;
        examRecord.reviewed = examRecord.students;
        examRecord.pending = 0;
      }
      renderComplete(container, state.stats);
    } else {
      renderProcessing(container, examId);
    }
    return;
  }

  renderReviewPanel(container, examId, state);
}


// ── Sub-renderers ──────────────────────────────────────────────────────────────

function renderProcessing(container, examId) {
  container.innerHTML = `
    <h1 class="page-title">Review queue</h1>
    <div class="card" style="max-width:480px;margin:60px auto;text-align:center;padding:32px">
      <i class="ti ti-loader-2 ti-spin" style="font-size:40px;color:var(--brand);margin-bottom:16px" aria-hidden="true"></i>
      <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:6px">AI Grading in progress</div>
      <div style="font-size:var(--text-sm);color:var(--neutral-500)">
        Exam <code>${examId}</code> is still being processed.<br>
        This page will refresh automatically.
      </div>
      <div class="progress" style="margin-top:20px"><div class="progress-bar" style="width:60%;animation:none"></div></div>
    </div>`;

  // Poll every 3 s until next_review is available
  let timer = setInterval(async () => {
    try {
      const s = await getPipelineState(examId);
      if (s.next_review || s.is_complete || s.error) {
        clearInterval(timer);
        render(container);
      }
    } catch { clearInterval(timer); }
  }, 3000);
}

function renderComplete(container, stats) {
  store.activeExamId = null;
  container.innerHTML = `
    <h1 class="page-title">Review queue</h1>
    <div class="card" style="max-width:500px;margin:60px auto;text-align:center;padding:32px">
      <i class="ti ti-circle-check" style="font-size:48px;color:var(--brand);margin-bottom:16px" aria-hidden="true"></i>
      <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:16px">All reviews complete!</div>
      <div style="text-align:left;background:var(--neutral-50);border:1px solid var(--neutral-200);border-radius:var(--radius-md);padding:16px;margin-bottom:20px;font-size:var(--text-sm)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px">
          ${statRow('Students',       stats.total_students)}
          ${statRow('Total marks',    stats.total_marks)}
          ${statRow('Class average',  stats.class_average)}
          ${statRow('Pass rate',      `${stats.pass_rate}%`)}
          ${statRow('Highest score',  stats.highest)}
          ${statRow('Lowest score',   stats.lowest)}
          ${statRow('AI–TA agreement', `${stats.ai_ta_agreement_rate}%`)}
          ${statRow('Plagiarism flags', stats.flagged_plagiarism)}
        </div>
      </div>
      <button class="btn btn-primary" id="go-exams" style="width:100%;justify-content:center">
        <i class="ti ti-list" aria-hidden="true"></i> View all exams
      </button>
    </div>`;
  container.querySelector('#go-exams')?.addEventListener('click', () => navigate('exams'));
}

function renderReviewPanel(container, examId, state) {
  const r = state.next_review;   // interrupt payload from review_node
  const students = state.students ?? [];
  const reviewed = students.filter(s => s.ta_decision !== null).length;
  const total    = students.length;

  const grade       = r.grade ?? {};
  const qGrades     = grade.question_grades ?? [];
  const totalScore  = qGrades.reduce((s, q) => s + q.score, 0);
  const maxScore    = qGrades.reduce((s, q) => s + q.max_score, 0);
  const ocrPct      = Math.round((r.ocr_confidence ?? 1) * 100);
  const ocrBadge    = ocrPct >= 85 ? 'badge-green' : ocrPct >= 70 ? 'badge-amber' : 'badge-red';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Review queue</h1>
        <p class="page-sub">${r.student_id} · Exam ${examId} · ${total - reviewed} remaining</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:var(--text-sm);color:var(--neutral-600)">
        <div class="progress" style="width:80px">
          <div class="progress-bar" style="width:${Math.round(reviewed / Math.max(total, 1) * 100)}%"></div>
        </div>
        ${reviewed + 1} of ${total}
      </div>
    </div>

    <div class="grid-60-40">
      <!-- Evidence column -->
      <div>
        <div class="card">
          <div class="card-title">Student answer (OCR transcript)</div>
          <div style="background:var(--neutral-50);border:1px solid var(--neutral-200);border-radius:var(--radius-md);padding:14px 16px;font-size:var(--text-base);line-height:1.8;color:var(--neutral-900);min-height:140px;white-space:pre-wrap">${escHtml(r.transcript ?? '(no transcript)')}</div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <span class="badge ${ocrBadge}"><i class="ti ti-scan" aria-hidden="true"></i> OCR ${ocrPct}%</span>
            ${r.needs_priority_review ? '<span class="badge badge-red"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Priority review</span>' : ''}
            ${r.plagiarism_score != null ? `<span class="badge badge-amber"><i class="ti ti-copy" aria-hidden="true"></i> Similarity ${Math.round(r.plagiarism_score * 100)}% with ${r.plagiarism_match}</span>` : ''}
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div class="card-title" style="margin:0">AI Grades by question</div>
            <span style="font-size:var(--text-xl);font-weight:700;letter-spacing:-0.5px">
              ${totalScore.toFixed(1)}
              <span style="font-size:var(--text-md);color:var(--neutral-400);font-weight:400"> / ${maxScore}</span>
            </span>
          </div>
          ${qGrades.map(q => `
            <div style="padding:10px 0;border-bottom:1px solid var(--neutral-100)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-weight:600;font-size:var(--text-sm)">${escHtml(q.question_id)}</span>
                <span style="font-size:var(--text-sm);font-weight:600;color:var(--brand)">${q.score} / ${q.max_score}</span>
              </div>
              <div style="font-size:var(--text-xs);color:var(--neutral-500);line-height:1.5">${escHtml(q.justification ?? '')}</div>
              ${(q.criteria_met ?? []).length ? `
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
                  ${q.criteria_met.map(c => `<span class="badge badge-green" style="font-size:10px;padding:1px 6px">${escHtml(c)}</span>`).join('')}
                </div>` : ''}
            </div>`).join('')}
          <div style="font-size:var(--text-xs);color:var(--neutral-400);margin-top:10px;line-height:1.5">
            ${escHtml(grade.overall_justification ?? '')}
          </div>
        </div>
      </div>

      <!-- Decision column -->
      <div>
        <div class="card" style="position:sticky;top:calc(var(--hdr) + 16px)">
          <div class="card-title">Your decision</div>

          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
            <button class="btn" id="btn-approve" style="width:100%;justify-content:center;padding:10px;border:1px solid var(--neutral-300);background:#fff">
              <i class="ti ti-circle-check" aria-hidden="true" style="color:var(--brand)"></i> Approve AI score
              <kbd style="margin-left:auto;opacity:0.6;font-size:10px;font-family:inherit">A</kbd>
            </button>
            <button class="btn" id="btn-override" style="width:100%;justify-content:center;padding:10px;border:1px solid var(--neutral-300);background:#fff">
              <i class="ti ti-edit" aria-hidden="true" style="color:var(--warning)"></i> Override score
              <kbd style="margin-left:auto;opacity:0.6;font-size:10px;font-family:inherit">O</kbd>
            </button>
            <button class="btn" id="btn-escalate" style="width:100%;justify-content:center;padding:10px;border:1px solid var(--neutral-300);background:#fff">
              <i class="ti ti-arrow-up" aria-hidden="true" style="color:var(--danger)"></i> Escalate to instructor
              <kbd style="margin-left:auto;opacity:0.6;font-size:10px;font-family:inherit">E</kbd>
            </button>
          </div>

          <div class="divider"></div>

          <div class="form-group">
            <label class="form-label" for="override-score">
              Override score <span style="font-weight:400;color:var(--neutral-400)">(0 – ${maxScore})</span>
            </label>
            <input type="number" id="override-score" placeholder="${totalScore.toFixed(1)}" min="0" max="${maxScore}" step="0.5" style="width:90px">
          </div>
          <div class="form-group">
            <label class="form-label" for="ta-comment">
              Comment <span style="font-weight:400;color:var(--neutral-400)">(optional)</span>
            </label>
            <textarea rows="3" id="ta-comment" placeholder="Reason for override or note for student…"></textarea>
          </div>
        </div>
      </div>
    </div>`;

  bindDecisionEvents(container, examId, totalScore, maxScore);
}


// ── Event binding ─────────────────────────────────────────────────────────────

function bindDecisionEvents(container, examId, aiScore, maxScore) {
  const getScore   = () => { 
    const v = container.querySelector('#override-score')?.value; 
    return v ? parseFloat(v) : aiScore; 
  };
  const getComment = () => container.querySelector('#ta-comment')?.value ?? '';

  async function decide(action, score = null, comment = '') {
    const btns = container.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);

    try {
      const result = await submitDecision(examId, action, score, comment);
      showToast(action === 'approve' ? 'Approved ✓' : action === 'override' ? 'Override saved ✓' : 'Escalated');
      await renderNav();

      if (result.is_complete) {
        const finalState = await getPipelineState(examId);
        
        // Update exam in store so Dashboard and Exams page show it as graded
        const examRecord = store.exams.find(e => e.id === examId);
        if (examRecord) {
          examRecord.status = 'graded';
          examRecord.students = finalState.stats?.total_students ?? 0;
          examRecord.reviewed = examRecord.students;
          examRecord.pending = 0;
        }

        renderComplete(container, finalState.stats ?? result.stats ?? {});
      } else {
        render(container);
      }
    } catch (err) {
      showToast(err.message ?? 'Failed to submit decision', 'error');
      btns.forEach(b => b.disabled = false);
    }
  }

  container.querySelector('#btn-approve').addEventListener('click',   () => decide('approve'));
  container.querySelector('#btn-override').addEventListener('click',  () => decide('override', getScore(), getComment()));
  container.querySelector('#btn-escalate').addEventListener('click',  () => decide('escalate'));

  document.addEventListener('keydown', onKey, { once: true });
  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'a' || e.key === 'A') container.querySelector('#btn-approve')?.click();
    if (e.key === 'o' || e.key === 'O') container.querySelector('#btn-override')?.click();
    if (e.key === 'e' || e.key === 'E') container.querySelector('#btn-escalate')?.click();
  }
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statRow(label, value) {
  return `<span style="color:var(--neutral-500)">${label}</span><strong>${value ?? '—'}</strong>`;
}
