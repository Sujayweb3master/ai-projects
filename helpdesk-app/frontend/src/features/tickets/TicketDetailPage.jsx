import { useLocation, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Loading, Notice } from '../../components/ui/Feedback.jsx';
import { Card, CardBody, PageHeader } from '../../components/ui/PageHeader.jsx';
import { copy } from '../../domain/copy.js';
import { formatDateTime } from '../../domain/labels.js';
import { canEditTicket } from '../../domain/ticketStatus.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AdminTicketPanel } from './AdminTicketPanel.jsx';
import { CommentThread } from './CommentThread.jsx';
import { useTicket } from './hooks.js';
import { TicketHistory } from './TicketHistory.jsx';
import styles from './Tickets.module.css';

export function TicketDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const ticketQuery = useTicket(id);

  if (ticketQuery.isPending) return <Loading label="Loading ticket…" />;
  if (ticketQuery.isError) {
    return ticketQuery.error.status === 404 || ticketQuery.error.status === 400 ? (
      <>
        <PageHeader title="Ticket Not Found" />
        <EmptyState
          icon="?"
          title="Ticket not found"
          body={copy.tickets.notFound}
          action={<ButtonLink to="/tickets">Back to tickets</ButtonLink>}
        />
      </>
    ) : (
      <ErrorState
        title="Couldn't load this ticket"
        error={ticketQuery.error}
        onRetry={() => ticketQuery.refetch()}
      />
    );
  }

  const ticket = ticketQuery.data;
  const isAdmin = user.role === 'ADMIN';

  return (
    <>
      <PageHeader
        title={ticket.title}
        docTitle={`Ticket: ${ticket.title}`}
        actions={
          <>
            <ButtonLink to="/tickets" variant="ghost">
              <span aria-hidden="true">←</span> All tickets
            </ButtonLink>
            {canEditTicket(ticket, user) && (
              <ButtonLink to={`/tickets/${ticket.id}/edit`}>Edit ticket</ButtonLink>
            )}
          </>
        }
      />
      {location.state?.created && (
        <div className={styles.noticeWrap}>
          <Notice>{copy.tickets.created}</Notice>
        </div>
      )}
      <div className={styles.detail}>
        <div className={styles.stack}>
          <Card aria-labelledby="description-title">
            <CardBody>
              <h2 id="description-title" className={styles.sectionTitle}>
                Description
              </h2>
              {/* Rendered as text only — never as HTML. */}
              <p className={styles.description}>{ticket.description}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CommentThread ticket={ticket} user={user} />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <TicketHistory ticketId={ticket.id} />
            </CardBody>
          </Card>
        </div>
        <Card as="aside" aria-labelledby="details-title">
          <CardBody>
            <h2 id="details-title" className={styles.sectionTitle}>
              Details
            </h2>
            <dl className={styles.facts}>
              <dt>Status</dt>
              <dd>
                <Badge kind="status" value={ticket.status} />
              </dd>
              <dt>Priority</dt>
              <dd>
                <Badge kind="priority" value={ticket.priority} />
              </dd>
              <dt>Assignee</dt>
              <dd>{ticket.assignee?.name ?? <span className={styles.muted}>Unassigned</span>}</dd>
              <dt>Raised by</dt>
              <dd>{ticket.creator.name}</dd>
              <dt>Opened</dt>
              <dd className="tabular">{formatDateTime(ticket.createdAt)}</dd>
              <dt>Updated</dt>
              <dd className="tabular">{formatDateTime(ticket.updatedAt)}</dd>
              {ticket.resolvedAt && (
                <>
                  <dt>Resolved</dt>
                  <dd className="tabular">{formatDateTime(ticket.resolvedAt)}</dd>
                </>
              )}
              {ticket.closedAt && (
                <>
                  <dt>Closed</dt>
                  <dd className="tabular">{formatDateTime(ticket.closedAt)}</dd>
                </>
              )}
            </dl>
            {isAdmin && <AdminTicketPanel ticket={ticket} currentUser={user} />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
