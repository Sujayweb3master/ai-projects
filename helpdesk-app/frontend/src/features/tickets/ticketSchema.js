import { z } from 'zod';
import { copy } from '../../domain/copy.js';
import { PRIORITIES } from '../../domain/labels.js';

export const ticketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, copy.validation.titleLength)
    .max(200, 'Title must be 200 characters or fewer'),
  description: z
    .string()
    .trim()
    .min(1, 'Describe the problem so we can help')
    .max(10_000, 'Description must be 10,000 characters or fewer'),
  priority: z.enum(PRIORITIES),
});
