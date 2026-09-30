import { useNavigate } from 'react-router';
import { Card, CardBody, PageHeader } from '../../components/ui/PageHeader.jsx';
import { useCreateTicket } from './hooks.js';
import { TicketForm } from './TicketForm.jsx';

export function NewTicketPage() {
  const navigate = useNavigate();
  const create = useCreateTicket();
  return (
    <>
      <PageHeader title="New Ticket" description="Tell us what's wrong and we'll pick it up." />
      <Card>
        <CardBody>
          <TicketForm
            submitLabel="Create ticket"
            pendingLabel="Creating…"
            cancelTo="/tickets"
            onSubmit={async (values) => {
              const ticket = await create.mutateAsync(values);
              // Land on the new ticket with a clear confirmation (the journey's key moment).
              navigate(`/tickets/${ticket.id}`, { state: { created: true } });
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
