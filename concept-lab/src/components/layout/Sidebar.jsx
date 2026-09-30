import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { conceptsRegistry } from '@/concepts-registry'
import styles from './Sidebar.module.css'

function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const [openCategories, setOpenCategories] = useState(() =>
    Object.fromEntries(conceptsRegistry.map(({ category }) => [category, true])),
  )

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  return (
    <>
      {isOpen && <button className={styles.backdrop} aria-label="Close navigation" onClick={onClose} />}
      <aside
        id="concept-navigation"
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
        aria-label="Concept navigation"
      >
        <div className={styles.sidebarHeader}>
          <span>Concepts</span>
          <button className={styles.closeButton} type="button" onClick={onClose}>Close</button>
        </div>
        <nav>
          {conceptsRegistry.map(({ category, concepts }) => {
            const hasActiveConcept = concepts.some(({ path }) => path === location.pathname)
            const isOpenForCategory = openCategories[category] || hasActiveConcept

            return (
              <section className={styles.category} key={category}>
                <button
                  className={styles.categoryButton}
                  type="button"
                  aria-expanded={isOpenForCategory}
                  onClick={() => toggleCategory(category)}
                >
                  <span>{category}</span>
                  <span aria-hidden="true">{isOpenForCategory ? '−' : '+'}</span>
                </button>
                {isOpenForCategory && (
                  <div className={styles.links}>
                    {concepts.length > 0 ? concepts.map((concept) => (
                      <NavLink
                        className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
                        key={concept.id}
                        to={concept.path}
                        onClick={onClose}
                      >
                        {concept.title}
                      </NavLink>
                    )) : <p className={styles.empty}>Coming soon</p>}
                  </div>
                )}
              </section>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
