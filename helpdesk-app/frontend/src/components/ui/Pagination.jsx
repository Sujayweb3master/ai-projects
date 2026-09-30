import { Button } from './Button.jsx';
import styles from './Surface.module.css';

export function Pagination({ page, totalPages, total, onChange, label = 'Pagination' }) {
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label={label}>
      <Button size="small" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <span aria-hidden="true">←</span> Previous
      </Button>
      <span className="tabular" aria-live="polite">
        Page {page} of {totalPages}
        {total !== undefined && <span className={styles.muted}> · {total} total</span>}
      </span>
      <Button size="small" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next <span aria-hidden="true">→</span>
      </Button>
    </nav>
  );
}
