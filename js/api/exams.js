/**
 * api/exams.js — Exam CRUD operations.
 *
 * All functions are async and return plain objects/arrays.
 * Replace the bodies with real fetch() calls when connecting a backend:
 *   const res = await fetch('/api/exams', { method: 'GET', headers: {...} });
 *   return res.json();
 */

import { store, delay } from '../state.js';
import { getPipelineState } from './pipeline.js';

export async function getExams() {
  await delay();
  
  // Sync processing exams with the backend to show partial progress
  for (const exam of store.exams) {
    if (exam.status === 'processing') {
      try {
        const state = await getPipelineState(exam.id);
        if (state.students && state.students.length > 0) {
          exam.students = state.students.length;
          exam.reviewed = state.students.filter(s => !!s.ta_decision).length;
          exam.pending  = exam.students - exam.reviewed;
          if (state.status === 'complete') {
            exam.status = 'graded';
          }
        }
      } catch (err) {
        console.warn('Failed to sync exam status:', err);
      }
    }
  }

  return [...store.exams];
}

export async function createExam({ id, name, course, rubricName, students = 0 }) {
  await delay();
  const exam = {
    id:       id || Date.now(),
    name,
    course,
    pages:    0,
    uploaded: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status:   'processing',
    rubric:   rubricName || null,
    students: students,
    reviewed: 0,
    pending:  students,
  };
  store.exams.unshift(exam);
  return exam;
}

export async function deleteExam(id) {
  await delay();
  store.exams = store.exams.filter(e => e.id !== id);
}
