/**
 * router.js — Page registry and navigation.
 *
 * To add a new page:
 *   1. Create js/pages/my-page.js with `export async function render(container) { ... }`
 *   2. Add an entry to PAGE_REGISTRY below.
 *   3. Add a nav item to sidebar.js.
 *   That's it.
 */

import { store } from './state.js';
import { renderSidebar } from './components/sidebar.js';
import { getReviewStats } from './api/reviews.js';

// Lazy-load page modules so only the active page is imported on first visit
const PAGE_REGISTRY = {
  'dashboard':    () => import('./pages/dashboard.js'),
  'upload':       () => import('./pages/upload.js'),
  'exams':        () => import('./pages/exams.js'),
  'rubrics':      () => import('./pages/rubrics.js'),
  'courses':      () => import('./pages/courses.js'),
  'users':        () => import('./pages/users.js'),
  'reports':      () => import('./pages/reports.js'),
  'ta-dashboard': () => import('./pages/ta-dashboard.js'),
  'ta-review':    () => import('./pages/ta-review.js'),
  'ta-approved':  () => import('./pages/ta-approved.js'),
  'ta-exams':     () => import('./pages/ta-exams.js'),
};

const DEFAULT_PAGE = { instructor: 'dashboard', ta: 'ta-dashboard' };

export async function navigate(pageId) {
  const role = store.role;

  // Validate the requested page exists; fall back to role default
  if (!PAGE_REGISTRY[pageId]) {
    pageId = DEFAULT_PAGE[role] ?? 'dashboard';
  }

  store.page = pageId;

  // Reflect current page in URL without a full reload
  const url = new URL(window.location);
  url.searchParams.set('page', pageId);
  window.history.pushState({ page: pageId }, '', url);

  await Promise.all([renderCurrentPage(), renderNav()]);
}

export async function renderNav() {
  const stats  = await getReviewStats();
  const badges = { 'ta-review': stats.pending || undefined };
  renderSidebar(store.role, store.page, badges, navigate);
}

async function renderCurrentPage() {
  const container = document.getElementById('main-content');
  if (!container) return;

  // Show a subtle loading state while the module loads
  container.setAttribute('aria-busy', 'true');

  try {
    const loader = PAGE_REGISTRY[store.page];
    const module = await loader();
    await module.render(container);
  } catch (err) {
    console.error(`[router] Failed to render page "${store.page}":`, err);
    container.innerHTML = `
      <div class="empty" style="margin-top:80px">
        <i class="ti ti-alert-circle" aria-hidden="true"></i>
        <p>Something went wrong loading this page.</p>
      </div>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// Handle browser back/forward
window.addEventListener('popstate', e => {
  const pageId = e.state?.page ?? new URL(window.location).searchParams.get('page') ?? DEFAULT_PAGE[store.role];
  store.page = pageId;
  Promise.all([renderCurrentPage(), renderNav()]);
});
