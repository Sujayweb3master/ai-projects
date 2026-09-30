import { useId, useState } from 'react';
import styles from './Field.module.css';

/** Shared label / hint / error wiring so every control gets aria-invalid + aria-describedby. */
function useFieldIds(id) {
  const generated = useId();
  const fieldId = id ?? generated;
  return { fieldId, hintId: `${fieldId}-hint`, errorId: `${fieldId}-error` };
}

function describedBy(hint, error, ids) {
  return [hint && ids.hintId, error && ids.errorId].filter(Boolean).join(' ') || undefined;
}

function FieldShell({ label, markOptional, hint, error, ids, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={ids.fieldId} className={styles.label}>
        {label}
        {markOptional && <span className={styles.required}> (optional)</span>}
      </label>
      {hint && (
        <span id={ids.hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {children}
      {error && (
        <span id={ids.errorId} className={styles.error}>
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  required = true,
  markOptional = false,
  id,
  ref,
  ...inputProps
}) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} markOptional={markOptional} hint={hint} error={error} ids={ids}>
      <input
        ref={ref}
        id={ids.fieldId}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        aria-required={required || undefined}
        {...inputProps}
      />
    </FieldShell>
  );
}

/** Password input with a show/hide toggle; pasting stays allowed (modern-web-guidance). */
export function PasswordField({
  label,
  hint,
  error,
  required = true,
  markOptional = false,
  id,
  ref,
  ...inputProps
}) {
  const ids = useFieldIds(id);
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} markOptional={markOptional} hint={hint} error={error} ids={ids}>
      <div className={styles.passwordWrap}>
        <input
          ref={ref}
          id={ids.fieldId}
          type={visible ? 'text' : 'password'}
          className={styles.control}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, ids)}
          aria-required={required || undefined}
          {...inputProps}
        />
        <button
          type="button"
          className={styles.reveal}
          aria-controls={ids.fieldId}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  required = true,
  markOptional = false,
  id,
  ref,
  ...props
}) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} markOptional={markOptional} hint={hint} error={error} ids={ids}>
      <textarea
        ref={ref}
        id={ids.fieldId}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        aria-required={required || undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  required = true,
  markOptional = false,
  id,
  ref,
  children,
  ...props
}) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} markOptional={markOptional} hint={hint} error={error} ids={ids}>
      <select
        ref={ref}
        id={ids.fieldId}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        aria-required={required || undefined}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Multi-select as a fieldset of checkbox chips. */
export function CheckboxGroup({ legend, options, value, onChange, name }) {
  const toggle = (optionValue) =>
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.chip}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
