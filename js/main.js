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
<<<<<<< HEAD
=======
import { getCourses } from './api/courses.js';
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

async function boot() {
  // Read initial page from URL (supports deep-linking)
  const params  = new URL(window.location).searchParams;
  const initPage = params.get('page') ?? 'dashboard';

  await navigate(initPage);
<<<<<<< HEAD
  bindRoleSwitch();
}

=======
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

>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
function bindRoleSwitch() {
  document.getElementById('btn-instructor')?.addEventListener('click', () => switchRole('instructor'));
  document.getElementById('btn-ta')?.addEventListener('click',         () => switchRole('ta'));
}

async function switchRole(role) {
  store.role = role;

  // Update active role button styling
  document.getElementById('btn-instructor')?.classList.toggle('active', role === 'instructor');
  document.getElementById('btn-ta')?.classList.toggle('active',         role === 'ta');

<<<<<<< HEAD
  // Update avatar + course label in header
  const user = await getActiveUser(role);
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    avatarEl.textContent        = user.avatar;
    avatarEl.style.background   = user.color;
    avatarEl.style.color        = user.tc;
  }

  const courseLabel = document.getElementById('course-label');
  if (courseLabel) {
    const suffix = role === 'ta' ? ' | TA View' : '';
    courseLabel.textContent = `${store.course.code} — ${store.course.name}${suffix}`;
  }
=======
  await updateDynamicHeader();
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

  // Navigate to role's default landing page
  const defaultPage = role === 'instructor' ? 'dashboard' : 'ta-dashboard';
  await navigate(defaultPage);
}

document.addEventListener('DOMContentLoaded', boot);
