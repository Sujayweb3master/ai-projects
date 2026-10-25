import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { RegisterPage } from '../features/auth/RegisterPage.jsx';
import { NotFoundPage } from '../features/NotFoundPage.jsx';
import { EditTicketPage } from '../features/tickets/EditTicketPage.jsx';
import { NewTicketPage } from '../features/tickets/NewTicketPage.jsx';
import { TicketDetailPage } from '../features/tickets/TicketDetailPage.jsx';
import { TicketListPage } from '../features/tickets/TicketListPage.jsx';
import { UsersPage } from '../features/users/UsersPage.jsx';
import { ProtectedRoute, PublicOnlyRoute, RequireRole } from '../routes/guards.jsx';
import { AppShell, AuthLayout } from './AppShell.jsx';

export const routes = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/tickets" replace /> },
          { path: '/tickets', element: <TicketListPage /> },
          { path: '/tickets/new', element: <NewTicketPage /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
          { path: '/tickets/:id/edit', element: <EditTicketPage /> },
          {
            element: <RequireRole requiredRole="ADMIN" />,
            children: [{ path: '/admin/users', element: <UsersPage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
