/**
 * api/users.js — User management operations.
 */

import { store, delay } from '../state.js';

export async function getUsers() {
  await delay();
  return [...store.users];
}

export async function inviteUser({ email, role }) {
  await delay();
  const user = {
    id:     Date.now(),
    name:   email,
    email,
    role,
    avatar: email.substring(0, 2).toUpperCase(),
    color:  '#F1EFE8',
    tc:     '#5F5E5A',
  };
  store.users.push(user);
  return user;
}

export async function toggleUserRole(id) {
  await delay();
  const user = store.users.find(u => u.id === id);
  if (!user) throw new Error(`User ${id} not found`);
  user.role = user.role === 'ta' ? 'instructor' : 'ta';
  return { ...user };
}

export async function removeUser(id) {
  await delay();
  store.users = store.users.filter(u => u.id !== id);
}

export async function getActiveUser(role) {
  await delay();
  return store.users.find(u => u.role === role) ?? store.users[0];
}
