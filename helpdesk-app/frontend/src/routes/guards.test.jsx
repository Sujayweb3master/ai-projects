import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, signIn } from '../test/render.jsx';

describe('route guards and navigation', () => {
  it('redirects anonymous users to /login and returns them afterwards', async () => {
    const { router, user } = renderApp('/admin/users');
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    await user.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/users');
  });

  it('shows USERs an access-restricted screen on admin pages', async () => {
    signIn('alice');
    renderApp('/admin/users');
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('shows the Users link to admins only', async () => {
    signIn('alice');
    const first = renderApp('/tickets');
    const userNav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(userNav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    first.unmount();

    signIn('admin');
    renderApp('/tickets');
    const adminNav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(adminNav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('marks the current section and keeps Tickets current on a ticket page', async () => {
    signIn('alice');
    renderApp('/tickets/10000000-0000-4000-8000-000000000001');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'New ticket' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('redirects signed-in users away from /login', async () => {
    signIn('alice');
    const { router } = renderApp('/login');
    await screen.findByRole('heading', { name: 'My Tickets' });
    expect(router.state.location.pathname).toBe('/tickets');
  });
});
