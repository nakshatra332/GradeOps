/**
 * main.js — Application entry point.
 *
 * Responsibilities:
 *  - Boot the app on DOMContentLoaded
 *  - Handle role switching (updates store + re-renders header + re-navigates)
 *  - Read initial page from URL query param
 */

import { store } from './state.js';
import { navigate, renderNav } from './router.js';
import { getActiveUser } from './api/users.js';
import { getCourses } from './api/courses.js';

async function boot() {
  // Read initial page from URL (supports deep-linking)
  const params  = new URL(window.location).searchParams;
  const initPage = params.get('page') ?? 'dashboard';

  await navigate(initPage);
  await updateDynamicHeader();
  bindRoleSwitch();
}

async function updateDynamicHeader() {
  const role = store.role;
  const user = await getActiveUser(role);
  
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    avatarEl.textContent        = user.avatar;
    avatarEl.style.background   = user.color;
    avatarEl.style.color        = user.tc;
  }

  const courseLabel = document.getElementById('course-label');
  if (courseLabel) {
    try {
      const courses = await getCourses();
      const activeCourse = courses.find(c => c.id === store.selectedCourseId) || courses[0];
      if (activeCourse) {
        if (!store.selectedCourseId) store.selectedCourseId = activeCourse.id;
        const suffix = role === 'ta' ? ' | TA View' : '';
        courseLabel.textContent = `${activeCourse.code} — ${activeCourse.name}${suffix}`;
      } else {
        courseLabel.textContent = 'GradeOps';
      }
    } catch (err) {
      courseLabel.textContent = 'GradeOps';
    }
  }
}

function bindRoleSwitch() {
  document.getElementById('btn-instructor')?.addEventListener('click', () => switchRole('instructor'));
  document.getElementById('btn-ta')?.addEventListener('click',         () => switchRole('ta'));
}

async function switchRole(role) {
  store.role = role;

  // Update active role button styling
  document.getElementById('btn-instructor')?.classList.toggle('active', role === 'instructor');
  document.getElementById('btn-ta')?.classList.toggle('active',         role === 'ta');

  await updateDynamicHeader();

  // Navigate to role's default landing page
  const defaultPage = role === 'instructor' ? 'dashboard' : 'ta-dashboard';
  await navigate(defaultPage);
}

document.addEventListener('DOMContentLoaded', boot);
