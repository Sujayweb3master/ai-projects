import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge.jsx';
import { Skeleton } from '../../components/ui/Feedback.jsx';
import { formatDate } from '../../domain/labels.js';
import styles from './Tickets.module.css';

/**
 * Real <table> with a caption and column headers. On narrow screens it scrolls horizontally
 * inside a focusable region (data tables are exempt from WCAG 1.4.10 reflow).
 */
export function TicketTable({ tickets, showCreator, busy, loading }) {
  return (
    // Focusable so keyboard users can scroll it horizontally on small screens.
    <div
      className={styles.tableRegion}
      role="region"
      aria-labelledby="tickets-caption"
      tabIndex={0}
    >
      <table className={styles.table} aria-busy={busy || undefined}>
        <caption id="tickets-caption" className="visually-hidden">
          Tickets
        </caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Assignee</th>
            {showCreator && <th scope="col">Raised by</th>}
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td className={styles.titleCell}>
                    <Skeleton width="70%" />
                  </td>
                  {Array.from({ length: showCreator ? 5 : 4 }, (__, j) => (
                    <td key={j}>
                      <Skeleton width="5rem" />
                    </td>
                  ))}
                </tr>
              ))
            : tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className={styles.titleCell}>
                    <Link to={`/tickets/${ticket.id}`} className={styles.ticketLink}>
                      {ticket.title}
                    </Link>
                    <span className={`${styles.meta} tabular`}>
                      Opened {formatDate(ticket.createdAt)}
                    </span>
                  </td>
                  <td>
                    <Badge kind="status" value={ticket.status} />
                  </td>
                  <td>
                    <Badge kind="priority" value={ticket.priority} />
                  </td>
                  <td className={styles.nowrap}>
                    {ticket.assignee?.name ?? <span className={styles.muted}>Unassigned</span>}
                  </td>
                  {showCreator && <td className={styles.nowrap}>{ticket.creator.name}</td>}
                  <td className={`${styles.nowrap} tabular`}>{formatDate(ticket.updatedAt)}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
