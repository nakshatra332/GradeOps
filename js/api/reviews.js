/**
 * api/reviews.js — TA review queue operations.
 */

import { store, delay } from '../state.js';

export async function getPendingReviews() {
  await delay();
  return store.pendingReviews.filter(r => r.status === 'pending').map(r => ({ ...r }));
}

export async function getCompletedReviews() {
  await delay();
  return store.pendingReviews.filter(r => r.status !== 'pending').map(r => ({ ...r }));
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
  await delay();
  return {
    pending:    store.pendingReviews.filter(r => r.status === 'pending').length,
    approved:   store.pendingReviews.filter(r => r.status === 'approved').length,
    overridden: store.pendingReviews.filter(r => r.status === 'overridden').length,
  };
}
