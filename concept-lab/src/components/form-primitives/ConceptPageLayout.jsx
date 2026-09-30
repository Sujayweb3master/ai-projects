import styles from './ConceptPageLayout.module.css'

function ConceptPageLayout({ children, description, notes, tags, title }) {
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.tags} aria-label="Key APIs used">
          <span className={styles.tagLabel}>Key APIs used</span>
          {tags.map((tag) => <code className={styles.tag} key={tag}>{tag}</code>)}
        </div>
      </header>
      {children}
      {notes && <aside className={styles.notes}><strong>Notes</strong><p>{notes}</p></aside>}
    </article>
  )
}

export default ConceptPageLayout
