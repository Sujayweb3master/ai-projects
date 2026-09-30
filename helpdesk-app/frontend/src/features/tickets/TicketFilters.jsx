import { useEffect, useState } from 'react';
import { CheckboxGroup, Select, TextField } from '../../components/ui/Field.jsx';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../../domain/labels.js';
import { SORT_OPTIONS } from './listParams.js';
import styles from './Tickets.module.css';

const statusOptions = STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

/** Title search is debounced (300 ms) so the list doesn't refetch on every keystroke. */
function useDebouncedCallback(value, delay, callback) {
  useEffect(() => {
    const timer = setTimeout(() => callback(value), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the value changes
  }, [value, delay]);
}

export function TicketFilters({ params, onChange }) {
  const [search, setSearch] = useState(params.q);
  // Keep the box in sync when the URL changes elsewhere (presets, Clear filters, back button).
  const [lastQ, setLastQ] = useState(params.q);
  if (params.q !== lastQ) {
    setLastQ(params.q);
    setSearch(params.q);
  }
  useDebouncedCallback(search.trim(), 300, (q) => {
    if (q !== params.q) onChange({ q });
  });

  return (
    <div className={styles.filters}>
      <TextField
        label="Search titles"
        type="search"
        required={false}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="e.g. VPN"
        autoComplete="off"
      />
      <CheckboxGroup
        legend="Status"
        name="status"
        options={statusOptions}
        value={params.status}
        onChange={(status) => onChange({ status })}
      />
      <CheckboxGroup
        legend="Priority"
        name="priority"
        options={priorityOptions}
        value={params.priority}
        onChange={(priority) => onChange({ priority })}
      />
      <Select
        label="Sort by"
        required={false}
        value={params.sort}
        onChange={(event) => onChange({ sort: event.target.value })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
