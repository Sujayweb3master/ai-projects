import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../../domain/copy.js';
import { db, ids } from '../../test/msw/db.js';
import { renderApp, signIn } from '../../test/render.jsx';

const bob = () => db.current.users.find((u) => u.id === ids.bob);

describe('UsersPage', () => {
  it('makes the admin’s own row read-only', async () => {
    signIn('admin');
    renderApp('/admin/users');
    const row = (await screen.findByText('Ada Admin (you)')).closest('tr');
    expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(row).getByText(copy.users.selfNote)).toBeInTheDocument();
  });

  it('changes a role immediately and supports Undo', async () => {
    signIn('admin');
    const { user } = renderApp('/admin/users');
    await user.selectOptions(await screen.findByLabelText('Role for Bob Smith'), 'ADMIN');
    await waitFor(() => expect(bob().role).toBe('ADMIN'));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(bob().role).toBe('USER'));
  });

  it('requires confirmation before deactivating, then allows reactivation', async () => {
    signIn('admin');
    const { user } = renderApp('/admin/users');
    await user.click(await screen.findByRole('button', { name: 'Deactivate Bob Smith' }));
    const dialog = await screen.findByRole('dialog', {
      name: copy.users.deactivateTitle('Bob Smith'),
    });
    expect(dialog).toHaveTextContent(copy.users.deactivateBody);
    expect(bob().isActive).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(bob().isActive).toBe(false));
    await user.click(await screen.findByRole('button', { name: 'Reactivate Bob Smith' }));
    await waitFor(() => expect(bob().isActive).toBe(true));
  });
});
