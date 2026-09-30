import { screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { ids } from './msw/db.js';
import { renderApp, signIn } from './render.jsx';

/** Run axe against the rendered document. Colour contrast needs real layout, so it's
 *  checked in the browser audit instead (docs/ACCESSIBILITY.md). */
async function violations() {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: true } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

describe('automated accessibility checks (axe-core)', () => {
  it('login page', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign In' });
    expect(await violations()).toEqual([]);
  });

  it('ticket list (admin)', async () => {
    signIn('admin');
    renderApp('/tickets');
    await screen.findByRole('link', { name: 'VPN drops every hour' });
    expect(await violations()).toEqual([]);
  });

  it('ticket detail (admin panel)', async () => {
    signIn('admin');
    renderApp(`/tickets/${ids.t1}`);
    await screen.findByLabelText('Move to');
    expect(await violations()).toEqual([]);
  });

  it('new ticket form with errors', async () => {
    signIn('alice');
    const { user } = renderApp('/tickets/new');
    await user.click(await screen.findByRole('button', { name: 'Create ticket' }));
    await screen.findByRole('alert');
    expect(await violations()).toEqual([]);
  });

  it('users page', async () => {
    signIn('admin');
    renderApp('/admin/users');
    await screen.findByLabelText('Role for Bob Smith');
    expect(await violations()).toEqual([]);
  });
});
