import { api } from './http.js';

export const login = (credentials) =>
  api('/auth/login', { method: 'POST', body: credentials, auth: false });
export const register = (input) =>
  api('/auth/register', { method: 'POST', body: input, auth: false });
export const logout = () =>
  api('/auth/logout', { method: 'POST', auth: false, headers: { 'X-Requested-With': 'fetch' } });
