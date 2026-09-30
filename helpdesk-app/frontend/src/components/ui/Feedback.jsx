import { useEffect, useRef } from 'react';
import { messageForError } from '../../domain/copy.js';
import { Button, Spinner } from './Button.jsx';
import styles from './Feedback.module.css';
import { useDelayedFlag } from './hooks.js';

export function EmptyState({ title, body, action, icon = '☰' }) {
  return (
    <div className={styles.state}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      {body && <p className={styles.stateBody}>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, error, onRetry }) {
  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.icon} ${styles.errorIcon}`} aria-hidden="true">
        !
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateBody}>{message ?? messageForError(error)}</p>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Loading({ label = 'Loading…', delay = 300 }) {
  const show = useDelayedFlag(true, delay);
  return (
    <div className={styles.loadingLine} role="status" aria-live="polite">
      {show && (
        <>
          <Spinner />
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

export function Skeleton({ width = '100%' }) {
  return <span className={styles.skeleton} style={{ width }} aria-hidden="true" />;
}

/**
 * Error summary at the top of a form. Receives focus when it appears so keyboard and
 * screen-reader users land on it after a failed submit (accessible-error-announcement).
 */
export function FormErrorSummary({ title = 'There is a problem', message, fieldErrors = {} }) {
  const ref = useRef(null);
  const entries = Object.entries(fieldErrors);
  const visible = Boolean(message) || entries.length > 0;
  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible, message]);
  if (!visible) return null;
  return (
    <div ref={ref} className={styles.summary} role="alert" tabIndex={-1}>
      <p className={styles.summaryTitle}>{title}</p>
      {message && <p>{message}</p>}
      {entries.length > 0 && (
        <ul>
          {entries.map(([name, error]) => (
            <li key={name}>
              <a href={`#field-${name}`}>{error}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Notice({ children }) {
  return (
    <div className={styles.notice} role="status">
      {children}
    </div>
  );
}
