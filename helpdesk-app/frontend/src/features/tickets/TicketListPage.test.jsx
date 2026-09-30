import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../../domain/copy.js';
import { db } from '../../test/msw/db.js';
import { renderApp, signIn } from '../../test/render.jsx';

describe('TicketListPage', () => {
  it('lists tickets in a table with status and priority as text', async () => {
    signIn('alice');
    renderApp('/tickets');
    const link = await screen.findByRole('link', { name: 'VPN drops every hour' });
    const row = link.closest('tr');
    expect(row).toHaveTextContent('Open');
    expect(row).toHaveTextContent('High');
    expect(screen.getByRole('status', { name: '' })).toBeDefined();
    expect(screen.getByText('2 tickets')).toBeInTheDocument();
  });

  it('syncs filters to the URL and the API query, resetting the page', async () => {
    signIn('alice');
    const { user, router } = renderApp('/tickets?page=2');
    await screen.findByText('2 tickets');
    await user.click(screen.getByRole('checkbox', { name: 'In progress' }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=IN_PROGRESS'));
    await waitFor(() => expect(db.current.requests.at(-1)).toContain('status=IN_PROGRESS'));
    expect(await screen.findByRole('link', { name: 'Printer jam' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'VPN drops every hour' })).not.toBeInTheDocument();
  });

  it('debounces title search into the URL', async () => {
    signIn('alice');
    const { user, router } = renderApp('/tickets');
    await screen.findByRole('link', { name: 'Printer jam' });
    await user.type(screen.getByLabelText('Search titles'), 'vpn');
    await waitFor(() => expect(router.state.location.search).toBe('?q=vpn'));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Printer jam' })).not.toBeInTheDocument(),
    );
  });

  it('distinguishes "no matches" (with Clear filters) from "no tickets yet"', async () => {
    signIn('alice');
    const { user, router } = renderApp('/tickets?priority=MEDIUM');
    expect(await screen.findByText(copy.tickets.emptyFilteredTitle)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(router.state.location.search).not.toContain('priority'));

    db.current.tickets = [];
    const second = renderApp('/tickets');
    expect(await second.findByText(copy.tickets.emptyFirstTitle)).toBeInTheDocument();
    expect(second.getByRole('link', { name: 'Create ticket' })).toBeInTheDocument();
  });

  it('shows an error state with Retry when loading fails', async () => {
    signIn('alice');
    const { server } = await import('../../test/msw/server.js');
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.get('/api/v1/tickets', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/tickets');
    expect(await screen.findByText(copy.tickets.loadError)).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Printer jam' })).toBeInTheDocument();
  });

  it('opens admins on the triage view and offers quick views', async () => {
    signIn('admin');
    const { user, router } = renderApp('/tickets');
    await waitFor(() =>
      expect(router.state.location.search).toBe('?status=OPEN&status=IN_PROGRESS&sort=-priority'),
    );
    expect(screen.getByRole('button', { name: 'Open & in progress' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Unassigned' }));
    await waitFor(() => expect(router.state.location.search).toContain('assigneeId=unassigned'));
    expect(screen.getByRole('button', { name: 'Unassigned' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
