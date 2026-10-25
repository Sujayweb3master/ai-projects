import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

/** @param {z.ZodError} error */
const toDetails = (error) =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/**
 * Validate params, query and body against strict Zod schemas.
 * Parsed values are exposed on `req.valid` (Express 5 makes req.query read-only).
 * @param {{ params?: z.ZodType, query?: z.ZodType, body?: z.ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const valid = {};
    const details = [];
    for (const part of /** @type {const} */ (['params', 'query', 'body'])) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        valid[part] = result.data;
      } else {
        details.push(
          ...toDetails(result.error).map((d) => ({
            ...d,
            path: d.path ? `${part}.${d.path}` : part,
          })),
        );
      }
    }
    if (details.length > 0) return next(badRequest('Request validation failed', details));
    req.valid = valid;
    next();
  };
}

export const uuidParam = z.object({ id: z.uuid() }).strict();
