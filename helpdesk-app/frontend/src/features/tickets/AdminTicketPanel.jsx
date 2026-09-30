import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { copy, messageForError } from '../../domain/copy.js';
import { STATUS_LABELS } from '../../domain/labels.js';
import { allowedNextStatuses } from '../../domain/ticketStatus.js';
import { useAssignableAdmins, useChangeAssignee, useChangeStatus } from './hooks.js';
import styles from './Tickets.module.css';

/** Inline feedback next to the control that triggered it (interaction-design). */
function InlineFeedback({ mutation, successText }) {
  if (mutation.isError) {
    return (
      <p className={styles.inlineError} role="alert">
        {messageForError(mutation.error)}
      </p>
    );
  }
  return (
    <p className={styles.inlineStatus} role="status">
      {mutation.isPending ? 'Saving…' : mutation.isSuccess ? `✓ ${successText}` : ''}
    </p>
  );
}

function StatusControl({ ticket }) {
  const options = allowedNextStatuses(ticket.status);
  const [next, setNext] = useState(options[0] ?? '');
  const [confirming, setConfirming] = useState(false);
  const mutation = useChangeStatus(ticket.id);
  // Reset the choice when the ticket's status changes underneath us.
  const [seenStatus, setSeenStatus] = useState(ticket.status);
  if (seenStatus !== ticket.status) {
    setSeenStatus(ticket.status);
    setNext(options[0] ?? '');
  }

  const apply = (status) =>
    mutation.mutate(status, {
      // Inline feedback next to the control is enough; no duplicate toast.
      onSuccess: () => setConfirming(false),
      onError: () => setConfirming(false),
    });

  if (options.length === 0) {
    return (
      <p className={`${styles.panelSection} ${styles.muted}`}>
        This ticket is closed. No further changes can be made.
      </p>
    );
  }

  return (
    <div>
      <form
        className={styles.panelSection}
        onSubmit={(event) => {
          event.preventDefault();
          // Closing is irreversible, so it's the one status change that asks first.
          if (next === 'CLOSED') setConfirming(true);
          else apply(next);
        }}
      >
        <Select
          label="Move to"
          required={false}
          hint={`Currently ${STATUS_LABELS[ticket.status]}`}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <div className={styles.inlineRow}>
          <Button
            type="submit"
            loading={mutation.isPending && !confirming}
            loadingLabel="Updating…"
          >
            Update status
          </Button>
        </div>
        <InlineFeedback mutation={mutation} successText="Status updated" />
      </form>
      <ConfirmDialog
        open={confirming}
        title={copy.tickets.closeTitle}
        body={copy.tickets.closeBody}
        confirmLabel={copy.tickets.closeConfirm}
        cancelLabel={copy.tickets.closeCancel}
        pending={mutation.isPending}
        onConfirm={() => apply('CLOSED')}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function AssigneeControl({ ticket, currentUser }) {
  const admins = useAssignableAdmins(true);
  const mutation = useChangeAssignee(ticket.id);
  const current = ticket.assignee?.id ?? '';
  const [choice, setChoice] = useState(current);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setChoice(current);
  }

  const [savedText, setSavedText] = useState('Assignee saved');
  const assign = (assigneeId, label) => {
    setSavedText(assigneeId ? `Assigned to ${label}` : 'Ticket unassigned');
    mutation.mutate(assigneeId);
  };
  const nameOf = (id) => admins.data?.data.find((u) => u.id === id)?.name ?? 'admin';

  return (
    <form
      className={styles.panelSection}
      onSubmit={(event) => {
        event.preventDefault();
        assign(choice || null, nameOf(choice));
      }}
    >
      <Select
        label="Assignee"
        required={false}
        value={choice}
        disabled={admins.isPending}
        onChange={(event) => setChoice(event.target.value)}
        hint={admins.isError ? "Couldn't load admins. Reload to try again." : undefined}
      >
        <option value="">Unassigned</option>
        {admins.data?.data.map((admin) => (
          <option key={admin.id} value={admin.id}>
            {admin.name}
            {admin.id === currentUser.id ? ' (you)' : ''}
          </option>
        ))}
      </Select>
      <div className={styles.inlineRow}>
        <Button
          type="submit"
          disabled={choice === current}
          loading={mutation.isPending}
          loadingLabel="Saving…"
        >
          Save assignee
        </Button>
        {current !== currentUser.id && (
          <Button
            variant="ghost"
            onClick={() => assign(currentUser.id, 'you')}
            disabled={mutation.isPending}
          >
            Assign to me
          </Button>
        )}
      </div>
      <InlineFeedback mutation={mutation} successText={savedText} />
    </form>
  );
}

/** Admin-only controls on the ticket detail page. */
export function AdminTicketPanel({ ticket, currentUser }) {
  return (
    <section aria-labelledby="admin-panel-title">
      <h2 id="admin-panel-title" className="visually-hidden">
        Admin actions
      </h2>
      <StatusControl ticket={ticket} />
      {ticket.status !== 'CLOSED' && <AssigneeControl ticket={ticket} currentUser={currentUser} />}
    </section>
  );
}
