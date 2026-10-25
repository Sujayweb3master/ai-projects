/** Mirrors the backend error shape: { error: { code, message, details?, requestId } }. */
export class ApiError extends Error {
  /**
   * @param {{ status: number, code: string, message: string, details?: Array<{path: string, message: string}>, requestId?: string }} init
   */
  constructor({ status, code, message, details, requestId }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
    this.requestId = requestId;
  }
}

export const isApiError = (error) => error instanceof ApiError;

/**
 * Map server validation details (e.g. "body.title") onto form field names ("title").
 * @param {ApiError} error
 * @returns {Record<string, string>}
 */
export function fieldErrorsFrom(error) {
  const fields = {};
  for (const detail of error?.details ?? []) {
    const name = detail.path.replace(/^(body|query|params)\./, '');
    if (name && !fields[name]) fields[name] = detail.message;
  }
  return fields;
}
