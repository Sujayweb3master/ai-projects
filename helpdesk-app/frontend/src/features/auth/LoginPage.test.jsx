import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../../domain/copy.js';
import { useAuthStore } from '../../stores/authStore.js';
import { renderApp } from '../../test/render.jsx';

describe('LoginPage', () => {
  it('uses labelled fields with the right autocomplete hints', () => {
    renderApp('/login');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('validates after interaction and on submit, without calling the API', async () => {
    const { user } = renderApp('/login');
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.tab();
    expect(await screen.findByText(copy.validation.email)).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
  });

  it('shows a focused error summary for wrong credentials', async () => {
    const { user } = renderApp('/login');
    await user.type(screen.getByLabelText('Email address'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.auth.invalidCredentials);
    expect(alert).toHaveFocus();
  });

  it('toggles password visibility', async () => {
    const { user } = renderApp('/login');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveTextContent('Hide');
  });

  it('signs in and lands on the ticket list', async () => {
    const { user, router } = renderApp('/login');
    await user.type(screen.getByLabelText('Email address'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tickets');
    expect(useAuthStore.getState().accessToken).toBe('token-1');
  });

  it('explains why the user was signed out', () => {
    useAuthStore.setState({ signOutReason: 'expired' });
    renderApp('/login');
    expect(screen.getByText(copy.auth.sessionExpired)).toBeInTheDocument();
  });
});
