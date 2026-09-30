import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * In-memory limiter (per process). With several replicas each keeps its own counters;
 * see README "Known limitations".
 * @param {{ limit: number, windowMs?: number }} options
 */
export const createLimiter = ({ limit, windowMs = FIFTEEN_MINUTES }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Key on client IP + route so login attempts don't eat into the refresh budget.
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${req.baseUrl}${req.path}`,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')),
  });
