import pino from 'pino';

/**
 * Structured JSON logger. Secrets and credentials are redacted at the source.
 * @param {{ level?: string, pretty?: boolean }} [options]
 */
export function createLogger({ level = 'info', pretty = false } = {}) {
  return pino({
    level,
    base: { service: 'helpdesk-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.accessToken',
      ],
      censor: '[REDACTED]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
