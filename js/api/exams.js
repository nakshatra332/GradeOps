/**
 * api/exams.js — Exam CRUD operations.
 *
 * Connected to the FastAPI backend. getExams() fetches the real exam list
 * from MongoDB via GET /pipeline/. Data persists across page refreshes.
 */

import { getPipelineState } from './pipeline.js';

const API_BASE = 'http://localhost:8000';

/**
 * Fetch all exams from the backend (which reads from MongoDB).
 * Falls back to an empty array if the server is unreachable.
 */
export async function getExams() {
  try {
    const res = await fetch(`${API_BASE}/pipeline/`);
    if (!res.ok) {
      console.error('Failed to fetch exams from backend');
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('Backend unreachable, returning empty exam list:', err.message);
    return [];
  }
}

/**
 * Create an exam entry.
 * The real creation happens via startPipeline() in api/pipeline.js.
 * This just returns a placeholder object so the UI can show it immediately
 * while the pipeline starts processing in the background.
 */
export async function createExam({ id, name, course, rubricName, students = 0 }) {
  return {
    id:       id || Date.now(),
    name,
    course,
    pages:    0,
    uploaded: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status:   'processing',
    rubric:   rubricName || null,
    students,
    reviewed: 0,
    pending:  students,
  };
}

/**
 * Delete an exam. Not yet implemented on the backend.
 */
export async function deleteExam(id) {
  console.warn('Delete not implemented on backend yet');
}
