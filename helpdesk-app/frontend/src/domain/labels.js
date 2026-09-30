export const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
export const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
export const ROLE_LABELS = { ADMIN: 'Admin', USER: 'User' };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatDate = (iso) => (iso ? dateFormat.format(new Date(iso)) : '—');
export const formatDateTime = (iso) => (iso ? dateTimeFormat.format(new Date(iso)) : '—');
