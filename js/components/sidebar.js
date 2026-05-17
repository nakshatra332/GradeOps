/**
 * components/sidebar.js — Sidebar navigation renderer.
 *
 * Renders nav items for the given role and marks the active page.
 * Completely stateless — takes data, returns HTML, attaches listeners.
 *
 * `onNavigate` is injected by the caller (router.js) to avoid a circular import.
 */

const INSTRUCTOR_NAV = [
  { id: 'dashboard',  icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { section: 'Exams' },
  { id: 'upload',     icon: 'ti-upload',           label: 'Upload Exams' },
  { id: 'exams',      icon: 'ti-files',            label: 'Manage Exams' },
  { section: 'Rubrics' },
  { id: 'rubrics',    icon: 'ti-list-check',       label: 'Rubric Manager' },
  { section: 'Team' },
  { id: 'users',      icon: 'ti-users',            label: 'Users & Roles' },
  { section: 'Reports' },
  { id: 'reports',    icon: 'ti-chart-bar',        label: 'Grade Reports' },
];

const TA_NAV = [
  { id: 'ta-dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { section: 'Review' },
  { id: 'ta-review',    icon: 'ti-eye',              label: 'Pending Reviews' },
  { id: 'ta-approved',  icon: 'ti-check',            label: 'Approved' },
  { section: 'Info' },
  { id: 'ta-exams',     icon: 'ti-files',            label: 'Exam Sheets' },
];

/**
 * @param {string}   role        - 'instructor' | 'ta'
 * @param {string}   activePage  - current page ID
 * @param {Object}   badges      - { [pageId]: number } — optional badge counts
 * @param {Function} onNavigate  - navigate callback injected by router to avoid circular deps
 */
export function renderSidebar(role, activePage, badges = {}, onNavigate = () => {}) {
  const nav = role === 'instructor' ? INSTRUCTOR_NAV : TA_NAV;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = nav.map(item => {
    if (item.section) {
      return `<div class="nav-section">${item.section}</div>`;
    }
    const isActive  = activePage === item.id;
    const badgeCount = badges[item.id];
    const badge     = badgeCount ? `<span class="nav-badge">${badgeCount}</span>` : '';
    return `
      <div class="nav-item ${isActive ? 'active' : ''}" data-page="${item.id}" role="button" tabindex="0">
        <i class="ti ${item.icon}" aria-hidden="true"></i>
        ${item.label}${badge}
      </div>`;
  }).join('');

  // Attach listeners after DOM is updated
  sidebar.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => onNavigate(el.dataset.page));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onNavigate(el.dataset.page); });
  });
}
