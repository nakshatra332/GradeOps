/**
 * pages/users.js — Manage course members and permissions.
 */

import { getUsers, inviteUser, toggleUserRole, removeUser } from '../api/users.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  const users = await getUsers();
  const instructors = users.filter(u => u.role === 'instructor');
  const tas         = users.filter(u => u.role === 'ta');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Team</h1>
        <p class="page-sub">${instructors.length} instructor${instructors.length !== 1 ? 's' : ''} · ${tas.length} TA${tas.length !== 1 ? 's' : ''}</p>
      </div>
    </div>

    <div class="grid2">
      <!-- Members table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 18px 14px">
          <div class="card-title" style="margin:0">Members</div>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => userRow(u)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Invite form -->
      <div class="card">
        <div class="card-title">Invite someone</div>
        <div class="form-group">
          <label class="form-label" for="invite-email">Email address</label>
          <input type="email" id="invite-email" placeholder="colleague@university.edu">
        </div>
        <div class="form-group">
          <label class="form-label" for="invite-role">Role</label>
          <select id="invite-role">
            <option value="ta">Teaching Assistant</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>
        <button class="btn btn-primary" style="width:100%" id="invite-btn">
          <i class="ti ti-send" aria-hidden="true"></i> Send invite
        </button>
      </div>
    </div>`;

  bindEvents(container);
}

function bindEvents(container) {
  container.querySelectorAll('[data-toggle-role]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await toggleUserRole(Number(btn.dataset.toggleRole));
      showToast('Role updated');
      render(container);
    });
  });

  container.querySelectorAll('[data-remove-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this member from the course?')) return;
      await removeUser(Number(btn.dataset.removeUser));
      showToast('Member removed');
      render(container);
    });
  });

  container.querySelector('#invite-btn').addEventListener('click', async () => {
    const email = container.querySelector('#invite-email')?.value?.trim();
    const role  = container.querySelector('#invite-role')?.value;
    if (!email) { showToast('Enter an email address', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email', 'error'); return; }
    await inviteUser({ email, role });
    showToast(`Invite sent to ${email}`);
    render(container);
  });
}

function userRow(u) {
  const isInstructor = u.role === 'instructor';
  return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="background:${u.color};color:${u.tc}">${u.avatar}</div>
          <div>
            <div style="font-weight:500">${u.name}</div>
            <div style="font-size:var(--text-xs);color:var(--neutral-400)">${u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${isInstructor ? 'badge-green' : 'badge-blue'}">
          ${isInstructor ? 'Instructor' : 'TA'}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="btn btn-sm" data-toggle-role="${u.id}" title="Toggle role">
            <i class="ti ti-switch-horizontal" aria-hidden="true"></i>
          </button>
          ${!isInstructor ? `
          <button class="btn btn-sm btn-icon btn-danger" data-remove-user="${u.id}" title="Remove">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
}
