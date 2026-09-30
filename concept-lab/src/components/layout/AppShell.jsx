import { useState } from 'react'
import { Outlet } from 'react-router'
import Sidebar from './Sidebar'
import styles from './AppShell.module.css'

function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  function closeSidebar() {
    setIsSidebarOpen(false)
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button
          className={styles.menuButton}
          type="button"
          aria-label="Open navigation"
          aria-expanded={isSidebarOpen}
          aria-controls="concept-navigation"
          onClick={() => setIsSidebarOpen(true)}
        >
          Menu
        </button>
        <span className={styles.brand}>concept-lab</span>
      </header>
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
