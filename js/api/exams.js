/**
<<<<<<< HEAD
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
=======
 * api/exams.js — Exam CRUD operations with backend persistence.
 */

import { store } from '../state.js';
import { getPipelineState } from './pipeline.js';

// Use the current origin as the API base if we're not on the default dev port (3000)
const API_BASE = window.location.port === '3000' ? 'http://localhost:8000' : '';

export async function getExams() {
  const res = await fetch(`${API_BASE}/metadata/exams`);
  if (!res.ok) throw new Error('Failed to fetch exams');
  const exams = await res.json();

  // Sync processing exams with the backend to update status and progress
  let needsSync = false;
  for (const exam of exams) {
    if (exam.status === 'processing') {
      try {
        const state = await getPipelineState(exam.id);
        if (state.students && state.students.length > 0) {
          exam.students = state.students.length;
          exam.reviewed = state.students.filter(s => !!s.ta_decision).length;
          if (state.status === 'complete' || state.is_complete) {
            exam.status = 'graded';
          }
          needsSync = true;
        }
      } catch (err) {
        console.warn('Failed to sync exam status:', err);
      }
    }
  }

  // If we updated any statuses, persist them back to the backend
  if (needsSync) {
    for (const exam of exams) {
      if (exam.status === 'graded') { // only bother updating if it changed to graded
        await updateExamOnBackend(exam);
      }
    }
  }

  return exams;
}

export async function createExam(examData) {
  const existingExams = await getExams();
  const existing = existingExams.find(e => e.id === examData.id);

  const exam = {
    id:       examData.id || `exam_${Math.random().toString(36).substr(2, 9)}`,
    name:     examData.name,
    course:   examData.course,
    courseId: examData.courseId,
    uploaded: existing ? existing.uploaded : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status:   existing ? existing.status : 'processing',
    rubric:   examData.rubricName || (existing ? existing.rubric : null),
    students: examData.students || (existing ? existing.students : 0),
    reviewed: existing ? existing.reviewed : 0,
  };

  await updateExamOnBackend(exam);
  return exam;
}

async function updateExamOnBackend(exam) {
  await fetch(`${API_BASE}/metadata/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exam),
  });
}

export async function deleteExam(id) {
  await fetch(`${API_BASE}/metadata/exams/${id}`, {
    method: 'DELETE',
  });
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
}
