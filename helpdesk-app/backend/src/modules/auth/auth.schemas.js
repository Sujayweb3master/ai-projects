import { z } from 'zod';

const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email('must be a valid email address'))
  .transform((value) => value.toLowerCase());

export const registerBody = z
  .object({
    email,
    name: z.string().trim().min(1, 'is required').max(100),
    password: z.string().min(12, 'must be at least 12 characters').max(128),
  })
  .strict();

export const loginBody = z
  .object({
    email,
    // No length rules on login: never hint at the password policy to an attacker.
    password: z.string().min(1, 'is required').max(128),
  })
  .strict();
