import ErrorText from './ErrorText'
import styles from './FormField.module.css'

function FormField({ children, error, hint, id, label }) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      {children}
      <ErrorText id={errorId} message={error} />
    </div>
  )
}

export default FormField
