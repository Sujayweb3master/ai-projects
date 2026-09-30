import styles from './ErrorText.module.css'

function ErrorText({ id, message }) {
  if (!message) return null

  return <p id={id} className={styles.error} role="alert">{message}</p>
}

export default ErrorText
