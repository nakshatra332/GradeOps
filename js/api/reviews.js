/**
 * api/reviews.js — TA review queue operations.
 */

import { store, delay } from '../state.js';
import { getPipelineState } from './pipeline.js';
import { getExams } from './exams.js';

export async function getPendingReviews() {
  await delay();
  return store.pendingReviews.filter(r => r.status === 'pending').map(r => ({ ...r }));
}

export async function getCompletedReviews() {
  const completed = [];
  const exams = await getExams();
  for (const exam of exams) {
    if (exam.status === 'processing' || exam.status === 'graded') {
      try {
        const state = await getPipelineState(exam.id);
        const students = state.students || [];
        for (const s of students) {
          if (s.ta_decision) {
            const maxScore = s.grade_output?.question_grades?.reduce((sum, q) => sum + q.max_score, 0) || 100;
            completed.push({
              student: s.student_id,
              q: exam.name,
              score: s.final_score ?? (s.grade_output?.total_score || 0),
              ai_score: s.grade_output?.total_score || 0,
              max: maxScore,
              status: s.ta_decision === 'approve' ? 'approved' : 'overridden',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch state for completed reviews', err);
      }
    }
  }
  return completed;
}

export async function approveReview(id) {
  await delay();
  const review = store.pendingReviews.find(r => r.id === id);
  if (!review) throw new Error(`Review ${id} not found`);
  review.status = 'approved';
  return { ...review };
}

export async function overrideReview(id, { score, comment } = {}) {
  await delay();
  const review = store.pendingReviews.find(r => r.id === id);
  if (!review) throw new Error(`Review ${id} not found`);
  review.status   = 'overridden';
  review.comment  = comment ?? '';
  if (score !== undefined && !Number.isNaN(score)) {
    review.ai_score = score;
  }
  return { ...review };
}

export async function skipReview(id) {
  await delay();
  const idx = store.pendingReviews.findIndex(r => r.id === id);
  if (idx !== -1) {
    // Move to end of the array so the next item surfaces
    store.pendingReviews.push(store.pendingReviews.splice(idx, 1)[0]);
  }
}

export async function getReviewStats() {
  const reviews = await getCompletedReviews();
  const exams = await getExams();
  const pendingCount = exams.filter(e => e.status === 'processing').length;
  
  return {
    pending: pendingCount,
    approved: reviews.filter(r => r.status === 'approved').length,
    overridden: reviews.filter(r => r.status === 'overridden').length,
  };
}
