import { useEffect } from 'react';
import { refreshSession } from '../api/http.js';
import { useAuthStore } from '../stores/authStore.js';
import styles from './AppShell.module.css';

/**
 * On page load the access token is gone (memory only), so try to restore the session
 * from the httpOnly refresh cookie before rendering routes.
 */
export function AuthBootstrap({ children }) {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (useAuthStore.getState().status !== 'unknown') return;
    refreshSession().catch(() => useAuthStore.getState().clear());
  }, []);

  if (status === 'unknown') {
    return (
      <div className={styles.splash} role="status" aria-live="polite">
        <span className={styles.brandMark} aria-hidden="true" />
        <span>Loading Helpdesk…</span>
      </div>
    );
  }
  return children;
}
