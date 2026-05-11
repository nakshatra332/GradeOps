/**
 * pages/ta-review.js — TA review queue: approve, override, or skip AI grades.
 *
 * UX principle: the action panel (right col) is the primary focus.
 * The evidence (left col) supports the decision — don't bury it.
 */

import { getPendingReviews, approveReview, overrideReview, skipReview } from '../api/reviews.js';
import { showToast } from '../components/toast.js';
import { renderNav } from '../router.js';

const CONF_BADGE  = { high: 'badge-green', low: 'badge-red', medium: 'badge-amber' };
const CONF_LABEL  = { high: 'High confidence', low: 'Low confidence', medium: 'Medium confidence' };

const RUBRIC_CRITERIA = [
  { text: 'Correct average case O(n log n)', pts: 2.5, met: true  },
  { text: 'Worst case O(n²) mentioned',      pts: 2.5, met: true  },
  { text: 'Partition step explained',        pts: 2.5, met: true  },
  { text: 'Recurrence T(n)=2T(n/2)+O(n)',   pts: 2.5, met: false },
];

export async function render(container) {
  const queue = await getPendingReviews();

  if (!queue.length) {
    container.innerHTML = `
      <h1 class="page-title">Review queue</h1>
      <div class="empty" style="margin-top:80px">
        <i class="ti ti-circle-check" aria-hidden="true"></i>
        <p>All caught up — no pending reviews</p>
      </div>`;
    return;
  }

  const r = queue[0];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Review queue</h1>
        <p class="page-sub">${r.student} · ${r.exam} · ${queue.length} remaining</p>
      </div>
      <!-- Progress through queue -->
      <div style="display:flex;align-items:center;gap:10px;font-size:var(--text-sm);color:var(--neutral-600)">
        <div class="progress" style="width:80px">
          <div class="progress-bar" style="width:${Math.round((1 / (queue.length + 1)) * 100)}%"></div>
        </div>
        1 of ${queue.length}
      </div>
    </div>

    <div class="grid-60-40">
      <!-- Evidence column -->
      <div>
        <div class="card">
          <div class="card-title">Student answer</div>
          <div style="background:var(--neutral-50);border:1px solid var(--neutral-200);border-radius:var(--radius-md);padding:14px 16px;font-size:var(--text-base);line-height:1.8;color:var(--neutral-900);min-height:140px">
            QuickSort has average time complexity of O(n log n) due to the recursive partition.
            In the worst case when the pivot is always the smallest or largest element, complexity
            degrades to O(n²). The partition step itself runs in O(n). This matches the recurrence
            T(n) = 2T(n/2) + O(n).
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <span class="badge badge-gray"><i class="ti ti-scan" aria-hidden="true"></i> OCR 94%</span>
            <span class="badge badge-gray">Page 3</span>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div class="card-title" style="margin:0">AI reasoning</div>
            <span class="badge ${CONF_BADGE[r.confidence] ?? 'badge-gray'}">${CONF_LABEL[r.confidence]}</span>
          </div>
          <p style="font-size:var(--text-base);line-height:1.7;color:var(--neutral-600)">
            Student correctly identified average O(n log n) and worst-case O(n²) complexities.
            Partition step was referenced but the recurrence derivation was brief.
            Partial credit awarded for the two main criteria met.
          </p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid var(--neutral-100)">
            <span style="font-size:var(--text-xs);color:var(--neutral-400)">Proposed score</span>
            <span style="font-size:var(--text-xl);font-weight:600;letter-spacing:-0.5px">
              ${r.ai_score}
              <span style="font-size:var(--text-md);color:var(--neutral-400);font-weight:400"> / ${r.max}</span>
            </span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Rubric checklist</div>
          ${RUBRIC_CRITERIA.map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--neutral-100)">
              <i class="ti ${c.met ? 'ti-circle-check' : 'ti-circle-x'}"
                 style="font-size:18px;color:${c.met ? 'var(--brand)' : 'var(--neutral-300)'};" aria-hidden="true"></i>
              <span style="flex:1;font-size:var(--text-base)">${c.text}</span>
              <span style="font-size:var(--text-xs);font-weight:500;color:${c.met ? 'var(--brand-dark)' : 'var(--neutral-400)'}">${c.met ? `+${c.pts}` : '0'} pts</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Decision column -->
      <div>
        <div class="card" style="position:sticky;top:calc(var(--hdr) + 16px)">
          <div class="card-title">Your decision</div>

          <!-- Primary actions -->
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
            <button class="btn btn-primary" id="btn-approve" style="width:100%;justify-content:center;padding:10px">
              <i class="ti ti-circle-check" aria-hidden="true"></i> Approve AI score
              <kbd style="margin-left:auto;opacity:0.6;font-size:10px;font-family:inherit">A</kbd>
            </button>
            <button class="btn btn-danger" id="btn-override" style="width:100%;justify-content:center;padding:10px">
              <i class="ti ti-edit" aria-hidden="true"></i> Override score
              <kbd style="margin-left:auto;opacity:0.6;font-size:10px;font-family:inherit">O</kbd>
            </button>
          </div>

          <div class="divider"></div>

          <!-- Override fields -->
          <div class="form-group">
            <label class="form-label" for="override-score">New score <span style="font-weight:400;color:var(--neutral-400)">(leave blank to keep AI's)</span></label>
            <input type="number" id="override-score" placeholder="${r.ai_score}" min="0" max="${r.max}" step="0.5" style="width:90px">
          </div>
          <div class="form-group">
            <label class="form-label" for="ta-comment">Comment <span style="font-weight:400;color:var(--neutral-400)">(optional)</span></label>
            <textarea rows="3" id="ta-comment" placeholder="Reason for override, notes for student…"></textarea>
          </div>

          <button class="btn" style="width:100%;justify-content:center;color:var(--neutral-400)" id="btn-skip">
            Skip for now
          </button>

          <div class="divider"></div>

          <!-- Queue list -->
          <div style="font-size:var(--text-xs);font-weight:600;color:var(--neutral-400);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">
            Queue (${queue.length})
          </div>
          ${queue.map((q, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;opacity:${i === 0 ? '1' : '0.45'}">
              <span style="font-size:var(--text-xs);color:var(--neutral-400);min-width:16px">${i + 1}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:var(--text-xs);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.student}</div>
                <div style="font-size:10px;color:var(--neutral-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.q.substring(0, 40)}…</div>
              </div>
              <span class="badge ${CONF_BADGE[q.confidence] ?? 'badge-gray'}" style="font-size:10px;padding:1px 6px">${q.confidence}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  bindDecisionEvents(container, r, queue.length);
}

function bindDecisionEvents(container, review, queueLength) {
  const getOverride = () => { const v = container.querySelector('#override-score')?.value; return v ? parseFloat(v) : NaN; };
  const getComment  = () => container.querySelector('#ta-comment')?.value ?? '';

  container.querySelector('#btn-approve').addEventListener('click', async () => {
    await approveReview(review.id);
    showToast('Approved');
    await renderNav();
    render(container);
  });

  container.querySelector('#btn-override').addEventListener('click', async () => {
    await overrideReview(review.id, { score: getOverride(), comment: getComment() });
    showToast('Override saved');
    await renderNav();
    render(container);
  });

  container.querySelector('#btn-skip').addEventListener('click', async () => {
    await skipReview(review.id);
    render(container);
  });

  document.addEventListener('keydown', onKeyDown, { once: true });
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'a' || e.key === 'A') container.querySelector('#btn-approve')?.click();
    if (e.key === 'o' || e.key === 'O') container.querySelector('#btn-override')?.click();
  }
}
