import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../../domain/copy.js';
import { renderApp, signIn } from '../../test/render.jsx';

describe('NewTicketPage', () => {
  it('shows client-side validation in a focused summary and next to fields', async () => {
    signIn('alice');
    const { user } = renderApp('/tickets/new');
    await user.click(await screen.findByRole('button', { name: 'Create ticket' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent(copy.validation.titleLength);
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Description/)).toHaveAttribute('aria-invalid', 'true');
    // Summary links move focus to the field they describe.
    await user.click(within(summary).getByRole('link', { name: copy.validation.titleLength }));
    expect(screen.getByLabelText(/^Title/)).toHaveFocus();
  });

  it('maps server validation errors onto fields and keeps the input', async () => {
    signIn('alice');
    const { user } = renderApp('/tickets/new');
    await user.type(await screen.findByLabelText(/^Title/), 'server says no');
    await user.type(screen.getByLabelText(/^Description/), 'Some detail');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(
      (await screen.findAllByText('Title is not allowed by the server')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('server says no');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Some detail');
  });

  it('creates the ticket and lands on it with a confirmation', async () => {
    signIn('alice');
    const { user, router } = renderApp('/tickets/new');
    await user.type(await screen.findByLabelText(/^Title/), 'Laptop will not boot');
    await user.type(screen.getByLabelText(/^Description/), 'Black screen after logo');
    await user.selectOptions(screen.getByLabelText(/^Priority/), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText(copy.tickets.created)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tickets/10000000-0000-4000-8000-0000000000ff');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Laptop will not boot' }),
    ).toBeInTheDocument();
  });
});
