import { ErrorState, Loading } from '../../components/ui/Feedback.jsx';
import { formatDateTime, STATUS_LABELS } from '../../domain/labels.js';
import { useEvents } from './hooks.js';
import styles from './Tickets.module.css';

function describe(event) {
  const actor = event.actor.name;
  switch (event.type) {
    case 'CREATED':
      return `${actor} raised the ticket`;
    case 'STATUS_CHANGED':
      return `${actor} changed status from ${STATUS_LABELS[event.fromValue]} to ${STATUS_LABELS[event.toValue]}`;
    case 'ASSIGNEE_CHANGED':
      if (!event.toUser) return `${actor} unassigned ${event.fromUser?.name ?? 'the ticket'}`;
      return `${actor} assigned the ticket to ${event.toUser.name ?? 'a former admin'}`;
    default:
      return `${actor} updated the ticket`;
  }
}

export function TicketHistory({ ticketId }) {
  const events = useEvents(ticketId);
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className={styles.sectionTitle}>
        History
      </h2>
      {events.isPending && <Loading label="Loading history…" />}
      {events.isError && <ErrorState error={events.error} onRetry={() => events.refetch()} />}
      {events.data && (
        <ol className={styles.timeline}>
          {events.data.data.map((event) => (
            <li key={event.id}>
              <span>{describe(event)}</span>
              <span className={`${styles.meta} tabular`}>
                <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
