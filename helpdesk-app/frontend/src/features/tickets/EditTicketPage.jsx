import { useNavigate, useParams } from 'react-router';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback.jsx';
import { Card, CardBody, PageHeader } from '../../components/ui/PageHeader.jsx';
import { copy } from '../../domain/copy.js';
import { canEditTicket } from '../../domain/ticketStatus.js';
import { toast } from '../../stores/toastStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useTicket, useUpdateTicket } from './hooks.js';
import { TicketForm } from './TicketForm.jsx';

export function EditTicketPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const ticketQuery = useTicket(id);
  const update = useUpdateTicket(id);

  if (ticketQuery.isPending) return <Loading label="Loading ticket…" />;
  if (ticketQuery.isError) {
    return ticketQuery.error.status === 404 ? (
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
      <ErrorState error={ticketQuery.error} onRetry={() => ticketQuery.refetch()} />
    );
  }

  const ticket = ticketQuery.data;
  if (!canEditTicket(ticket, user)) {
    return (
      <>
        <PageHeader title="Edit Ticket" />
        <EmptyState
          icon="🔒"
          title="This ticket can't be edited now"
          body={
            user.role === 'ADMIN'
              ? 'Closed tickets are read-only.'
              : 'You can edit a ticket only while it is open. Add a comment instead.'
          }
          action={<ButtonLink to={`/tickets/${id}`}>Back to ticket</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Ticket" docTitle={`Edit: ${ticket.title}`} />
      <Card>
        <CardBody>
          <TicketForm
            defaultValues={{
              title: ticket.title,
              description: ticket.description,
              priority: ticket.priority,
            }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            cancelTo={`/tickets/${id}`}
            onSubmit={async (values) => {
              await update.mutateAsync(values);
              toast(copy.tickets.saved);
              navigate(`/tickets/${id}`);
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
