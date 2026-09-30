import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../../stores/toastStore.js';
import { Button } from './Button.jsx';
import styles from './Surface.module.css';

const VISIBLE_MS = 6000;

function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(VISIBLE_MS);
  const startedAt = useRef(0);

  // Auto-dismiss after 6s, paused while hovered or focused (so Undo stays reachable).
  useEffect(() => {
    if (paused) return undefined;
    startedAt.current = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss]);

  return (
    <li
      className={styles.toast}
      data-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.toastMessage}>{toast.message}</span>
      {toast.action && (
        <Button
          size="small"
          variant="ghost"
          onClick={() => {
            toast.action.onAction();
            onDismiss();
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <Button size="small" variant="ghost" onClick={onDismiss} aria-label="Dismiss notification">
        ✕
      </Button>
    </li>
  );
}

/** Polite live region: announced by screen readers without stealing focus. */
export function ToastRegion() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <section aria-label="Notifications">
      <ol className={styles.toasts} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </ol>
    </section>
  );
}
