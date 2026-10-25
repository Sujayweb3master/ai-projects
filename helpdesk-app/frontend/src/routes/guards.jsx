import { Navigate, Outlet, useLocation } from 'react-router';
import { ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { useAuthStore } from '../stores/authStore.js';

/** Signed-in users only; remembers where they were going. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Login/register: bounce signed-in users to the app. */
export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'authenticated') {
    const to = location.state?.from?.pathname ?? '/tickets';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

/** UI-level role gate. The API enforces the same rule; this only avoids a dead-end screen. */
export function RequireRole({ requiredRole }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== requiredRole) {
    return (
      <>
        <PageHeader title="Access Restricted" />
        <EmptyState
          icon="🔒"
          title="You don't have access to this page"
          body="This area is for administrators. If you need access, ask an admin."
          action={<ButtonLink to="/tickets">Go to tickets</ButtonLink>}
        />
      </>
    );
  }
  return <Outlet />;
}
