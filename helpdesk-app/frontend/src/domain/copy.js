/**
 * Interface copy sheet (ux-writing skill). Voice: helpful, plain, calm — a competent colleague.
 * Buttons: sentence case, verb + object. Page titles: title case. Errors: what failed + what to do.
 * Tests import these strings so wording changes happen in one place.
 */
export const copy = {
  auth: {
    invalidCredentials: 'Email or password is incorrect. Check them and try again.',
    deactivated: 'Your account has been deactivated. Contact an administrator to restore access.',
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
    emailTaken: 'An account with this email already exists. Sign in instead.',
  },
  validation: {
    email: 'Enter a valid email address',
    required: (field) => `Enter ${field}`,
    passwordLength: 'Use at least 12 characters',
    titleLength: 'Title must be at least 3 characters',
  },
  tickets: {
    emptyFirstTitle: 'No Tickets Yet',
    emptyFirstBody: "When something isn't working, raise a ticket and we'll keep you updated here.",
    emptyFilteredTitle: 'No tickets match these filters',
    emptyFilteredBody: 'Try removing a filter or searching for a different title.',
    loadError: "Couldn't load tickets. Check your connection and try again.",
    notFound: "This ticket doesn't exist or you don't have access to it.",
    created: 'Ticket created. We’ll post updates here.',
    saved: 'Changes saved',
    closeTitle: 'Close This Ticket?',
    closeBody: "Closed tickets can't be reopened or edited.",
    closeConfirm: 'Close ticket',
    closeCancel: 'Keep open',
    commentClosed: 'This ticket is closed, so new comments are turned off.',
  },
  users: {
    deactivateTitle: (name) => `Deactivate ${name}?`,
    deactivateBody:
      "They'll be signed out everywhere and won't be able to sign in until reactivated.",
    deactivateConfirm: 'Deactivate',
    selfNote: "You can't change your own role or status.",
  },
  generic: {
    network: 'Could not reach the server. Check your connection and try again.',
    unexpected: 'Something unexpected happened on our side. Try again in a moment.',
  },
};

/**
 * Translate an ApiError into user-facing copy. Unknown errors fall back to the server message
 * (which is written for humans) or a generic line.
 */
export function messageForError(error) {
  switch (error?.code) {
    case 'NETWORK_ERROR':
      return copy.generic.network;
    case 'RATE_LIMITED':
      return copy.auth.rateLimited;
    case 'SESSION_EXPIRED':
      return copy.auth.sessionExpired;
    case 'EMAIL_TAKEN':
      return copy.auth.emailTaken;
    case 'INTERNAL':
      return copy.generic.unexpected;
    default:
      return error?.message ?? copy.generic.unexpected;
  }
}
