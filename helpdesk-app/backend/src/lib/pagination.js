import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
};

/** @param {{ page: number, pageSize: number }} params */
export const toOffset = ({ page, pageSize }) => ({
  limit: pageSize,
  offset: (page - 1) * pageSize,
});

/**
 * @template T
 * @param {T[]} data
 * @param {number} total
 * @param {{ page: number, pageSize: number }} params
 */
export const paginated = (data, total, { page, pageSize }) => ({
  data,
  meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
});

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
export const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
