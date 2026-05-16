/**
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
}
