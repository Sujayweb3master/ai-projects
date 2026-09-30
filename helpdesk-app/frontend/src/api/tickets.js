import { api } from './http.js';

export const listTickets = (query) => api('/tickets', { query });
export const getTicket = (id) => api(`/tickets/${id}`);
export const createTicket = (input) => api('/tickets', { method: 'POST', body: input });
export const updateTicket = (id, input) => api(`/tickets/${id}`, { method: 'PATCH', body: input });
export const changeStatus = (id, status) =>
  api(`/tickets/${id}/status`, { method: 'PATCH', body: { status } });
export const changeAssignee = (id, assigneeId) =>
  api(`/tickets/${id}/assignee`, { method: 'PATCH', body: { assigneeId } });
export const listComments = (id, query) => api(`/tickets/${id}/comments`, { query });
export const addComment = (id, body) =>
  api(`/tickets/${id}/comments`, { method: 'POST', body: { body } });
export const listEvents = (id) => api(`/tickets/${id}/events`);
