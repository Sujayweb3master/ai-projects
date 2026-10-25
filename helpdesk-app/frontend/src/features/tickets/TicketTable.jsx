/* eslint-disable jsx-a11y/no-interactive-element-to-noninteractive-role --
   Explicit table/row/cell roles are intentional: some browsers (notably older Safari) drop native
   table semantics when CSS changes `display`, which the mobile card layout does. */
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge.jsx';
import { Skeleton } from '../../components/ui/Feedback.jsx';
import { formatDate } from '../../domain/labels.js';
import styles from './Tickets.module.css';

/**
 * Real <table> with a caption and column headers. Below 40rem the CSS restyles rows as stacked
 * cards (each cell labelled via data-label) so nothing is hidden off-screen. Explicit ARIA table
 * roles keep the table semantics that some browsers drop when display is changed.
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
      <table className={styles.table} role="table" aria-busy={busy || undefined}>
        <caption id="tickets-caption" className="visually-hidden">
          Tickets
        </caption>
        <thead>
          <tr role="row">
            <th scope="col" role="columnheader">
              Title
            </th>
            <th scope="col" role="columnheader">
              Status
            </th>
            <th scope="col" role="columnheader">
              Priority
            </th>
            <th scope="col" role="columnheader">
              Assignee
            </th>
            {showCreator && (
              <th scope="col" role="columnheader">
                Raised by
              </th>
            )}
            <th scope="col" role="columnheader">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} role="row">
                  <td role="cell" className={styles.titleCell}>
                    <Skeleton size="lg" />
                  </td>
                  {Array.from({ length: showCreator ? 5 : 4 }, (__, j) => (
                    <td key={j} role="cell">
                      <Skeleton size="sm" />
                    </td>
                  ))}
                </tr>
              ))
            : tickets.map((ticket) => (
                <tr key={ticket.id} role="row">
                  <td role="cell" className={styles.titleCell}>
                    <Link to={`/tickets/${ticket.id}`} className={styles.ticketLink}>
                      {ticket.title}
                    </Link>
                    <span className={`${styles.meta} tabular`}>
                      Opened {formatDate(ticket.createdAt)}
                    </span>
                  </td>
                  <td role="cell" data-label="Status">
                    <Badge kind="status" value={ticket.status} />
                  </td>
                  <td role="cell" data-label="Priority">
                    <Badge kind="priority" value={ticket.priority} />
                  </td>
                  <td role="cell" data-label="Assignee" className={styles.nowrap}>
                    {ticket.assignee?.name ?? <span className={styles.muted}>Unassigned</span>}
                  </td>
                  {showCreator && (
                    <td role="cell" data-label="Raised by" className={styles.nowrap}>
                      {ticket.creator.name}
                    </td>
                  )}
                  <td role="cell" data-label="Updated" className={`${styles.nowrap} tabular`}>
                    {formatDate(ticket.updatedAt)}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
