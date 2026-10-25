import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from '../../domain/labels.js';
import styles from './Badge.module.css';

const LABELS = { status: STATUS_LABELS, priority: PRIORITY_LABELS, role: ROLE_LABELS };

/**
 * Badge variants: status | priority | role | neutral. Always renders text, never colour alone.
 * The optional `prefix` gives screen readers context ("Priority: High").
 */
export function Badge({ kind = 'neutral', value, prefix, children }) {
  const label = children ?? LABELS[kind]?.[value] ?? value;
  return (
    <span className={`${styles.badge} ${styles[`${kind}-${value}`] ?? ''}`}>
      {kind === 'status' && <span className={styles.dot} aria-hidden="true" />}
      {kind === 'priority' && value === 'HIGH' && <span aria-hidden="true">▲</span>}
      {prefix && <span className="visually-hidden">{prefix}: </span>}
      {label}
    </span>
  );
}
