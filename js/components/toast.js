/**
 * components/toast.js — Notification toast utility.
 *
 * Usage: showToast('Message saved', 'success' | 'error' | 'info')
 */

const DURATION_MS = 2200;

let toastTimeout = null;

export function showToast(message, type = 'success') {
  const toast   = document.getElementById('toast');
  const msgEl   = document.getElementById('toast-msg');
  const iconEl  = document.getElementById('toast-icon');

  const icons = { success: 'ti-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
  const colors = { success: '#0F6E56', error: '#A32D2D', info: '#185FA5' };

  if (!toast || !msgEl) return;

  msgEl.textContent       = message;
  iconEl.className        = `ti ${icons[type] ?? icons.success}`;
  toast.style.background  = colors[type] ?? colors.success;

  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), DURATION_MS);
}
