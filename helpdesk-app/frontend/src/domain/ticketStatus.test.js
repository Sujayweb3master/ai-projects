import { describe, expect, it } from 'vitest';
import { allowedNextStatuses, canComment, canEditTicket } from './ticketStatus.js';

describe('ticket rules (mirror of the API)', () => {
  it('matches the backend transition table exactly', () => {
    expect({
      OPEN: allowedNextStatuses('OPEN'),
      IN_PROGRESS: allowedNextStatuses('IN_PROGRESS'),
      RESOLVED: allowedNextStatuses('RESOLVED'),
      CLOSED: allowedNextStatuses('CLOSED'),
    }).toEqual({
      OPEN: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['OPEN', 'RESOLVED'],
      RESOLVED: ['IN_PROGRESS', 'CLOSED'],
      CLOSED: [],
    });
  });

  const owner = { id: 'u1', role: 'USER' };
  const other = { id: 'u2', role: 'USER' };
  const admin = { id: 'a1', role: 'ADMIN' };
  const ticket = (status) => ({ status, creator: { id: 'u1' } });

  it.each([
    ['OPEN', owner, true],
    ['IN_PROGRESS', owner, false],
    ['OPEN', other, false],
    ['RESOLVED', admin, true],
    ['CLOSED', admin, false],
  ])('canEditTicket(%s, %o) = %s', (status, user, expected) => {
    expect(canEditTicket(ticket(status), user)).toBe(expected);
  });

  it('lets only admins comment on closed tickets', () => {
    expect(canComment(ticket('CLOSED'), owner)).toBe(false);
    expect(canComment(ticket('CLOSED'), admin)).toBe(true);
    expect(canComment(ticket('RESOLVED'), owner)).toBe(true);
  });
});
