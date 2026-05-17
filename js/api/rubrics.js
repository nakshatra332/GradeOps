/**
 * api/rubrics.js — Rubric CRUD operations.
 */

import { store, delay } from '../state.js';

export async function getRubrics() {
  await delay();
  return [...store.rubrics];
}

export async function saveRubric({ name, jsonText }) {
  await delay();
  let questions = 0, totalMarks = 0;
  try {
    const parsed = JSON.parse(jsonText);
    questions  = parsed.questions?.length ?? 0;
    totalMarks = parsed.questions?.reduce((sum, q) => sum + (q.marks ?? 0), 0) ?? 0;
  } catch {
    // If JSON is invalid, still save with defaults
  }
  const rubric = {
    id:         Date.now(),
    name:       name.endsWith('.json') ? name : `${name}.json`,
    questions,
    totalMarks,
    created:    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
  store.rubrics.push(rubric);
  return rubric;
}

export async function deleteRubric(id) {
  await delay();
  store.rubrics = store.rubrics.filter(r => r.id !== id);
}
