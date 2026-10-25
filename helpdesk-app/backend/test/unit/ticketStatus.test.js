import { describe, expect, it } from 'vitest';
import { TICKET_STATUSES } from '../../src/db/schema.js';
import {
  allowedNextStatuses,
  canTransition,
  transitionTimestamps,
} from '../../src/domain/ticketStatus.js';

const ALLOWED = new Set([
  'OPEN->IN_PROGRESS',
  'OPEN->CLOSED',
  'IN_PROGRESS->OPEN',
  'IN_PROGRESS->RESOLVED',
  'RESOLVED->IN_PROGRESS',
  'RESOLVED->CLOSED',
]);

describe('ticket status transitions', () => {
  // Exhaustive: every (from, to) pair, including same-status "transitions".
  const pairs = TICKET_STATUSES.flatMap((from) => TICKET_STATUSES.map((to) => [from, to]));

  it.each(pairs)('%s -> %s matches the transition table', (from, to) => {
    expect(canTransition(from, to)).toBe(ALLOWED.has(`${from}->${to}`));
  });

  it('treats CLOSED as terminal', () => {
    expect(allowedNextStatuses('CLOSED')).toEqual([]);
  });

  it('rejects unknown statuses', () => {
    expect(canTransition('BOGUS', 'OPEN')).toBe(false);
    expect(allowedNextStatuses('BOGUS')).toEqual([]);
  });

  it('stamps resolvedAt / closedAt and clears resolvedAt on reopen', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(transitionTimestamps('RESOLVED', now)).toEqual({ resolvedAt: now });
    expect(transitionTimestamps('CLOSED', now)).toEqual({ closedAt: now });
    expect(transitionTimestamps('IN_PROGRESS', now)).toEqual({ resolvedAt: null });
  });
});
