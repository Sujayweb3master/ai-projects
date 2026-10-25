import { useEffect, useRef } from 'react';
import { useDocumentTitle } from './hooks.js';
import styles from './Surface.module.css';

/**
 * Page <h1>. After client-side navigation focus moves here so keyboard and screen-reader
 * users start at the new content instead of the old link position.
 */
export function PageHeader({ title, description, actions, docTitle }) {
  const ref = useRef(null);
  useDocumentTitle(docTitle ?? title);
  useEffect(() => {
    // Don't steal focus on the very first page load (the browser handles that).
    if (window.history.state?.idx > 0 || window.__hdNavigated) ref.current?.focus();
    window.__hdNavigated = true;
  }, []);
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {description && <p className={styles.muted}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function Card({ children, as: Tag = 'section', className = '', ...props }) {
  return (
    <Tag className={`${styles.card} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function CardBody({ children }) {
  return <div className={styles.cardBody}>{children}</div>;
}
