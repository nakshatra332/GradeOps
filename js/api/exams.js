/**
 * api/exams.js — Exam CRUD operations.
 *
 * All functions are async and return plain objects/arrays.
 * Replace the bodies with real fetch() calls when connecting a backend:
 *   const res = await fetch('/api/exams', { method: 'GET', headers: {...} });
 *   return res.json();
 */

import { store, delay } from '../state.js';

export async function getExams() {
  await delay();
  return [...store.exams];
}

export async function createExam({ name, course, rubricId }) {
  await delay();
  const exam = {
    id:       Date.now(),
    name,
    course,
    pages:    0,
    uploaded: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status:   'processing',
    rubric:   rubricId ? store.rubrics.find(r => r.id === rubricId)?.name ?? null : null,
    students: 0,
    reviewed: 0,
    pending:  0,
  };
  store.exams.unshift(exam);
  return exam;
}

export async function deleteExam(id) {
  await delay();
  store.exams = store.exams.filter(e => e.id !== id);
}
