import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../api/auth.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ToastRegion } from '../components/ui/ToastRegion.jsx';
import { selectIsAdmin, useAuthStore } from '../stores/authStore.js';
import styles from './AppShell.module.css';

export function SkipLink() {
  return (
    <a className={styles.skipLink} href="#main">
      Skip to main content
    </a>
  );
}

/** Role-aware primary navigation; aria-current marks the active section. */
export function NavBar() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const { pathname } = useLocation();
  // "Tickets" stays current on a ticket's detail/edit pages, but not on "New ticket".
  const links = [
    {
      to: '/tickets',
      label: 'Tickets',
      isCurrent: pathname.startsWith('/tickets') && pathname !== '/tickets/new',
    },
    { to: '/tickets/new', label: 'New ticket', isCurrent: pathname === '/tickets/new' },
    ...(isAdmin
      ? [{ to: '/admin/users', label: 'Users', isCurrent: pathname.startsWith('/admin/users') }]
      : []),
  ];
  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.navList}>
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={styles.navLink}
              aria-current={link.isCurrent ? 'page' : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await logout();
    } catch {
      // Even if the server call fails, forget the session locally.
    } finally {
      clear();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={styles.user}>
      <span className={styles.userName}>
        <span>{user.name}</span>
        <span className={styles.userEmail}>{user.email}</span>
      </span>
      <Badge kind="role" value={user.role} prefix="Role" />
      <Button size="small" onClick={signOut} loading={pending}>
        Sign out
      </Button>
    </div>
  );
}

export function AppShell() {
  return (
    <>
      <SkipLink />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/tickets" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            Helpdesk
          </Link>
          <NavBar />
          <UserMenu />
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <ToastRegion />
    </>
  );
}

/** Centered single-card layout for sign-in / sign-up. */
export function AuthLayout() {
  return (
    <>
      <SkipLink />
      <main id="main" className={styles.authLayout} tabIndex={-1}>
        <div className={styles.authCard}>
          <span className={`${styles.brand} ${styles.authBrand}`}>
            <span className={styles.brandMark} aria-hidden="true" />
            Helpdesk
          </span>
          <Outlet />
        </div>
      </main>
      <ToastRegion />
    </>
  );
}
