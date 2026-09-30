import { Link } from 'react-router';
import styles from './Button.module.css';

const cx = (...names) => names.filter(Boolean).join(' ');

export function Spinner({ className }) {
  return <span className={cx(styles.spinner, className)} aria-hidden="true" />;
}

/**
 * Button with variants primary | secondary | ghost | danger.
 * `loading` disables the button (no double submits) and announces the pending label.
 */
export function Button({
  variant = 'secondary',
  size,
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], size === 'small' && styles.small, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/** A link styled as a button (navigation, not an action). */
export function ButtonLink({ variant = 'secondary', size, className, ...props }) {
  return (
    <Link
      className={cx(styles.button, styles[variant], size === 'small' && styles.small, className)}
      {...props}
    />
  );
}
