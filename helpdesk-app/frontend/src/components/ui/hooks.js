import { useEffect, useState } from 'react';

/** Sets document.title for each route (announced by screen readers on navigation). */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Helpdesk` : 'Helpdesk';
  }, [title]);
}

/** True only after `active` has stayed true for `delay` ms, so fast responses don't flash. */
export function useDelayedFlag(active, delay = 300) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), delay);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delay]);
  return active && elapsed;
}
