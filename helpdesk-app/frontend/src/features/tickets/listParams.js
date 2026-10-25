import { PRIORITIES, STATUSES } from '../../domain/labels.js';

export const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: '-updatedAt', label: 'Recently updated' },
  { value: '-priority', label: 'Highest priority' },
  { value: 'priority', label: 'Lowest priority' },
];

const SORTS = new Set(SORT_OPTIONS.map((o) => o.value));
const pick = (values, allowed) =>
  values.flatMap((v) => v.split(',')).filter((v) => allowed.includes(v));

/** URL search params are the source of truth for list filters (shareable, survive reload). */
export function readListParams(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const sort = searchParams.get('sort');
  return {
    status: pick(searchParams.getAll('status'), STATUSES),
    priority: pick(searchParams.getAll('priority'), PRIORITIES),
    q: searchParams.get('q') ?? '',
    assigneeId: searchParams.get('assigneeId') ?? '',
    sort: SORTS.has(sort) ? sort : '-createdAt',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Serialise back to URL params, omitting defaults to keep URLs short. */
export function toSearchParams(params) {
  const next = new URLSearchParams();
  params.status?.forEach((s) => next.append('status', s));
  params.priority?.forEach((p) => next.append('priority', p));
  if (params.q) next.set('q', params.q);
  if (params.assigneeId) next.set('assigneeId', params.assigneeId);
  if (params.sort && params.sort !== '-createdAt') next.set('sort', params.sort);
  if (params.page && params.page > 1) next.set('page', String(params.page));
  return next;
}

/** API query: pageSize fixed, empty values dropped by the HTTP client. */
export const toApiQuery = (params) => ({ ...params, pageSize: 20 });

export const hasActiveFilters = (params) =>
  params.status.length > 0 ||
  params.priority.length > 0 ||
  Boolean(params.q) ||
  Boolean(params.assigneeId);

/** Admin triage presets (journey-mapping: "bring the data forward"). */
export const adminPresets = (userId) => [
  {
    id: 'active',
    label: 'Open & in progress',
    params: { status: ['OPEN', 'IN_PROGRESS'], sort: '-priority' },
  },
  {
    id: 'unassigned',
    label: 'Unassigned',
    params: { status: ['OPEN', 'IN_PROGRESS'], assigneeId: 'unassigned', sort: '-priority' },
  },
  {
    id: 'mine',
    label: 'Assigned to me',
    params: { status: ['OPEN', 'IN_PROGRESS', 'RESOLVED'], assigneeId: userId, sort: '-priority' },
  },
  {
    id: 'high',
    label: 'High priority',
    params: { status: ['OPEN', 'IN_PROGRESS'], priority: ['HIGH'] },
  },
];

export const ADMIN_DEFAULT = { status: ['OPEN', 'IN_PROGRESS'], sort: '-priority' };
