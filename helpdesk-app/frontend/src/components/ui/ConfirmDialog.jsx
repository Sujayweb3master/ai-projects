import { useEffect, useId, useRef } from 'react';
import { Button } from './Button.jsx';
import styles from './Surface.module.css';

/**
 * Native modal <dialog> (modern-web-guidance: light-dismiss-a-dialog).
 * showModal() gives focus trapping, Esc handling and top-layer rendering for free;
 * closedby="any" enables backdrop light-dismiss where supported, with a click-outside fallback.
 * Focus returns to the element that opened it. Use only for consequential actions.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);
  const returnFocusTo = useRef(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusTo.current = document.activeElement;
      dialog.showModal?.();
      if (!dialog.showModal) dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close?.();
      returnFocusTo.current?.focus?.();
    }
  }, [open]);

  const handleClick = (event) => {
    // Fallback light-dismiss for browsers without closedby support.
    if (event.target === ref.current && !pending) onCancel();
  };

  return (
    // The click handler only implements backdrop light-dismiss; Esc is handled natively.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      closedby="any"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={handleClick}
    >
      {open && (
        <>
          <div className={styles.dialogBody}>
            <h2 id={titleId}>{title}</h2>
            <p id={bodyId}>{body}</p>
          </div>
          <div className={styles.dialogActions}>
            <Button onClick={onCancel} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button variant={tone} onClick={onConfirm} loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
