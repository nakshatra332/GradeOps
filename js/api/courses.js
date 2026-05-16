/**
 * api/courses.js — Course management operations.
 */

// Use the current origin as the API base if we're not on the default dev port (3000)
const API_BASE = window.location.port === '3000' ? 'http://localhost:8000' : '';

export async function getCourses() {
  const res = await fetch(`${API_BASE}/metadata/courses`);
  if (!res.ok) throw new Error('Failed to fetch courses');
  return res.json();
}

export async function createCourse({ name, code }) {
  const res = await fetch(`${API_BASE}/metadata/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code }),
  });
  if (!res.ok) throw new Error('Failed to create course');
  return res.json();
}
