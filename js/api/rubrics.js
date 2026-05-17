/**
 * api/rubrics.js — Rubric CRUD operations.
 */

<<<<<<< HEAD
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
=======
// Use the current origin as the API base if we're not on the default dev port (3000)
const API_BASE = window.location.port === '3000' ? 'http://localhost:8000' : '';

export async function getRubrics() {
  const res = await fetch(`${API_BASE}/metadata/rubrics`);
  if (!res.ok) throw new Error('Failed to fetch rubrics');
  return res.json();
}

export async function getRubricContent(id) {
  const res = await fetch(`${API_BASE}/metadata/rubrics/${id}`);
  if (!res.ok) throw new Error('Failed to fetch rubric content');
  return res.json();
}

export async function saveRubric({ name, jsonText, course_id = null }) {
  let rubricJson;
  try {
    rubricJson = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  } catch (err) {
    throw new Error('Invalid JSON definition');
  }

  const questions = rubricJson.questions?.length ?? 0;
  const totalMarks = rubricJson.questions?.reduce((sum, q) => sum + (q.marks ?? 0), 0) ?? 0;

  const meta = {
    name: name.endsWith('.json') ? name : `${name}.json`,
    questions,
    total_marks: totalMarks,
    created_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    course_id
  };

  const res = await fetch(`${API_BASE}/metadata/rubrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rubric_meta: meta, rubric_json: rubricJson }),
  });

  if (!res.ok) throw new Error('Failed to save rubric to backend');
  return res.json();
}

export async function deleteRubric(id) {
  // Backend delete not implemented in metadata.py yet, but we could add it.
  console.warn('Delete rubric not yet implemented on backend');
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
}
