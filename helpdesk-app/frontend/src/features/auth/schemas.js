import { z } from 'zod';
import { copy } from '../../domain/copy.js';

const email = z
  .string()
  .trim()
  .min(1, copy.validation.required('your email address'))
  .pipe(z.email(copy.validation.email));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, copy.validation.required('your password')),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, copy.validation.required('your name')).max(100),
  email,
  password: z
    .string()
    .min(12, copy.validation.passwordLength)
    .max(128, 'Use 128 characters or fewer'),
});
