/**
 * Allowed ticket status transitions. CLOSED is terminal.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const STATUS_TRANSITIONS = Object.freeze({
  OPEN: Object.freeze(['IN_PROGRESS', 'CLOSED']),
  IN_PROGRESS: Object.freeze(['OPEN', 'RESOLVED']),
  RESOLVED: Object.freeze(['IN_PROGRESS', 'CLOSED']),
  CLOSED: Object.freeze([]),
});

/** @param {string} from */
export const allowedNextStatuses = (from) => STATUS_TRANSITIONS[from] ?? [];

/**
 * @param {string} from
 * @param {string} to
 */
export const canTransition = (from, to) => allowedNextStatuses(from).includes(to);

/**
 * Timestamp side-effects of a transition.
 * @param {string} to
 * @param {Date} now
 */
export function transitionTimestamps(to, now) {
  switch (to) {
    case 'RESOLVED':
      return { resolvedAt: now };
    case 'CLOSED':
      return { closedAt: now };
    case 'OPEN':
    case 'IN_PROGRESS':
      // Re-opening a resolved ticket clears the resolution time.
      return { resolvedAt: null };
    default:
      return {};
  }
}
