/**
 * Mirror of backend/src/domain/ticketStatus.js — used only to offer valid choices in the UI.
 * The server remains the authority and rejects anything else with 409.
 */
export const STATUS_TRANSITIONS = Object.freeze({
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
});

export const allowedNextStatuses = (from) => STATUS_TRANSITIONS[from] ?? [];

/** Owners may edit while OPEN; admins while not CLOSED (matches the API rules). */
export const canEditTicket = (ticket, user) =>
  user?.role === 'ADMIN'
    ? ticket.status !== 'CLOSED'
    : ticket.creator.id === user?.id && ticket.status === 'OPEN';

export const canComment = (ticket, user) => user?.role === 'ADMIN' || ticket.status !== 'CLOSED';
