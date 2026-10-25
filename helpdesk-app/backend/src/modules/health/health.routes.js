import { Router } from 'express';

/**
 * /healthz = liveness (process is up, no dependencies checked).
 * /readyz  = readiness (DB reachable and not shutting down).
 * @param {{ pool: import('pg').Pool, state: { shuttingDown: boolean } }} deps
 */
export function healthRouter({ pool, state }) {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/readyz', async (req, res) => {
    if (state.shuttingDown) return res.status(503).json({ status: 'shutting_down' });
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch (err) {
      req.log?.warn({ err }, 'Readiness check failed');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
