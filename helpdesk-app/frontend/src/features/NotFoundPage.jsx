import { ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page Not Found" />
      <EmptyState
        icon="?"
        title="We couldn't find that page"
        body="The link may be broken or the page may have moved."
        action={<ButtonLink to="/tickets">Go to tickets</ButtonLink>}
      />
    </>
  );
}
