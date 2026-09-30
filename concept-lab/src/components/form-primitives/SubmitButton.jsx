import styles from './SubmitButton.module.css'

function SubmitButton({ children = 'Submit', isSubmitting }) {
  return (
    <button className={styles.button} type="submit" disabled={isSubmitting}>
      {isSubmitting ? 'Submitting…' : children}
    </button>
  )
}

export default SubmitButton
