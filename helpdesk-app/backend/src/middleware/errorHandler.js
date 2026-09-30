import { AppError } from '../lib/errors.js';

/** 404 for any route that nothing else handled. */
export const notFoundHandler = (req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));

/** Converts every error into the single documented error shape. */
// Express identifies error handlers by their arity, so all 4 parameters must stay.
export function errorHandler(err, req, res, _next) {
  let error = err;
  if (!(error instanceof AppError)) {
    if (err?.type === 'entity.parse.failed') {
      error = new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
    } else if (err?.type === 'entity.too.large') {
      error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    } else {
      req.log?.error({ err }, 'Unhandled error');
      error = new AppError(500, 'INTERNAL', 'An unexpected error occurred');
    }
  }

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      requestId: req.id,
    },
  });
}
