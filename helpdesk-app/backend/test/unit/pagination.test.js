import { describe, expect, it } from 'vitest';
import { escapeLike, paginated, toOffset } from '../../src/lib/pagination.js';

describe('pagination helpers', () => {
  it('computes offsets', () => {
    expect(toOffset({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 });
  });

  it('builds meta with at least one page', () => {
    expect(paginated([], 0, { page: 1, pageSize: 20 }).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    expect(paginated([], 41, { page: 1, pageSize: 20 }).meta.totalPages).toBe(3);
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
  });
});
