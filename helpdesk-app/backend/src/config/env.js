import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const durationString = z.string().regex(/^\d+[smhd]$/, 'must look like 15m, 1h, 30s or 7d');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_SSL: booleanString.default(false),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL: durationString.default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),
  COOKIE_SECURE: booleanString.default(true),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

/**
 * Parse and validate environment variables. Throws a readable error listing every problem.
 * @param {Record<string, string | undefined>} source
 */
export function parseEnv(source) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(result.data);
}

/** @typedef {z.infer<typeof envSchema>} Env */

let cached;

/** Lazily parsed process env, so importing modules in tests doesn't require a full env. */
export function getEnv() {
  cached ??= parseEnv(process.env);
  return cached;
}
