/**
 * pages/ta-approved.js — Completed TA reviews.
 */

import { getCompletedReviews } from '../api/reviews.js';

export async function render(container) {
  const reviews = await getCompletedReviews();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Completed reviews</h1>
        <p class="page-sub">${reviews.length} review${reviews.length !== 1 ? 's' : ''} done</p>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr><th>Student</th><th>Question</th><th>Score</th><th>Decision</th></tr>
        </thead>
        <tbody>
          ${reviews.length
            ? reviews.map(r => `
              <tr>
                <td style="font-weight:500">${r.student}</td>
                <td style="color:var(--neutral-600)">${r.q.substring(0, 44)}…</td>
                <td style="font-weight:500">${r.ai_score} / ${r.max}</td>
                <td>
                  <span class="badge ${r.status === 'approved' ? 'badge-green' : 'badge-amber'}">
                    ${r.status === 'approved' ? 'Approved' : 'Overridden'}
                  </span>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="4"><div class="empty" style="padding:32px"><p>No reviews completed yet</p></div></td></tr>`}
        </tbody>
      </table>
    </div>`;
}
