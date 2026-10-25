import { api } from './http.js';

export const listUsers = (query) => api('/users', { query });
export const changeRole = (id, role) =>
  api(`/users/${id}/role`, { method: 'PATCH', body: { role } });
export const changeActive = (id, isActive) =>
  api(`/users/${id}/status`, { method: 'PATCH', body: { isActive } });
