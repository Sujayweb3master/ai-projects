import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * In-memory limiter (per process). With several replicas each keeps its own counters;
 * see README "Known limitations".
 *
 * Each limiter instance has its own store, so the key is the client IP only. Keying on the
 * request path would let attackers get fresh buckets via /LOGIN or /login/ (Express routing
 * is case-insensitive and ignores trailing slashes).
 * @param {{ limit: number, windowMs?: number }} options
 */
export const createLimiter = ({ limit, windowMs = FIFTEEN_MINUTES }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')),
  });
