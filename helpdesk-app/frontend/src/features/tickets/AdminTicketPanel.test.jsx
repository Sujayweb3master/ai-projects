import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../../domain/copy.js';
import { db, ids } from '../../test/msw/db.js';
import { renderApp, signIn } from '../../test/render.jsx';

const openTicket = (status, title = 'VPN drops every hour') => {
  Object.assign(db.current.tickets[0], { status, title });
  return `/tickets/${ids.t1}`;
};

describe('AdminTicketPanel', () => {
  // Explicit expectations (mirroring the backend rules), not derived from the UI's own table.
  it.each([
    ['OPEN', ['In progress', 'Closed']],
    ['IN_PROGRESS', ['Open', 'Resolved']],
    ['RESOLVED', ['In progress', 'Closed']],
  ])('offers exactly the allowed next statuses from %s', async (status, expected) => {
    signIn('admin');
    renderApp(openTicket(status));
    const select = await screen.findByLabelText('Move to');
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(expected);
  });

  it('shows no status control for a closed ticket', async () => {
    signIn('admin');
    renderApp(openTicket('CLOSED'));
    expect(await screen.findByText(/This ticket is closed/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Move to')).not.toBeInTheDocument();
  });

  it('changes status inline without a dialog for reversible moves', async () => {
    signIn('admin');
    const { user } = renderApp(openTicket('OPEN'));
    await user.selectOptions(await screen.findByLabelText('Move to'), 'IN_PROGRESS');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    expect(await screen.findByText('Status updated')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(db.current.tickets[0].status).toBe('IN_PROGRESS');
  });

  it('asks for confirmation before closing and can be cancelled', async () => {
    signIn('admin');
    const { user } = renderApp(openTicket('OPEN'));
    await user.selectOptions(await screen.findByLabelText('Move to'), 'CLOSED');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    const dialog = await screen.findByRole('dialog', { name: copy.tickets.closeTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.tickets.closeCancel }));
    expect(db.current.tickets[0].status).toBe('OPEN');

    await user.click(screen.getByRole('button', { name: 'Update status' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: copy.tickets.closeConfirm,
      }),
    );
    await waitFor(() => expect(db.current.tickets[0].status).toBe('CLOSED'));
  });

  it('shows a 409 conflict inline next to the control', async () => {
    signIn('admin');
    const { user } = renderApp(openTicket('IN_PROGRESS', 'conflict ticket'));
    await user.selectOptions(await screen.findByLabelText('Move to'), 'RESOLVED');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    expect(
      await screen.findByText('Ticket status changed concurrently, please reload'),
    ).toBeInTheDocument();
  });

  it('assigns the ticket to the current admin in one click', async () => {
    signIn('admin');
    const { user } = renderApp(openTicket('OPEN'));
    await user.click(await screen.findByRole('button', { name: 'Assign to me' }));
    await waitFor(() => expect(db.current.tickets[0].assignee?.id).toBe(ids.admin));
    expect(await screen.findByText('Assigned to you')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument();
  });

  it('is not rendered for USERs', async () => {
    signIn('alice');
    renderApp(openTicket('OPEN'));
    await screen.findByRole('heading', { level: 1, name: 'VPN drops every hour' });
    expect(screen.queryByLabelText('Move to')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit ticket' })).toBeInTheDocument();
  });
});
