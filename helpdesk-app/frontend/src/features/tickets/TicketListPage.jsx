import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { useDelayedFlag } from '../../components/ui/hooks.js';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Card, PageHeader } from '../../components/ui/PageHeader.jsx';
import { copy } from '../../domain/copy.js';
import { selectIsAdmin, useAuthStore } from '../../stores/authStore.js';
import { useTicketList } from './hooks.js';
import {
  ADMIN_DEFAULT,
  adminPresets,
  hasActiveFilters,
  readListParams,
  toApiQuery,
  toSearchParams,
} from './listParams.js';
import { TicketFilters } from './TicketFilters.jsx';
import { TicketTable } from './TicketTable.jsx';
import styles from './Tickets.module.css';

const sameParams = (a, b) => toSearchParams(a).toString() === toSearchParams(b).toString();

export function TicketListPage() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const userId = useAuthStore((s) => s.user.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readListParams(searchParams);

  // Admins land on the triage view (open + in progress, highest priority first).
  const needsAdminDefault = isAdmin && searchParams.toString() === '';
  useEffect(() => {
    if (needsAdminDefault) {
      setSearchParams(
        toSearchParams({ ...readListParams(new URLSearchParams()), ...ADMIN_DEFAULT }),
        {
          replace: true,
        },
      );
    }
  }, [needsAdminDefault, setSearchParams]);

  const query = useTicketList(toApiQuery(params));
  const showSkeleton = useDelayedFlag(query.isPending);

  /** Any filter change resets to page 1. */
  const update = (patch) => setSearchParams(toSearchParams({ ...params, page: 1, ...patch }));
  const clearFilters = () => setSearchParams(new URLSearchParams({ sort: params.sort }));
  const presets = isAdmin ? adminPresets(userId) : [];
  const base = { status: [], priority: [], q: '', assigneeId: '', sort: '-createdAt', page: 1 };

  const data = query.data;
  const filtered = hasActiveFilters(params);

  let content;
  if (query.isError && !data) {
    content = (
      <ErrorState
        title="Couldn't load tickets"
        message={copy.tickets.loadError}
        onRetry={() => query.refetch()}
      />
    );
  } else if (query.isPending) {
    content = showSkeleton ? <TicketTable tickets={[]} loading showCreator={isAdmin} /> : null;
  } else if (data.meta.total === 0) {
    content = filtered ? (
      <EmptyState
        icon="⌕"
        title={copy.tickets.emptyFilteredTitle}
        body={copy.tickets.emptyFilteredBody}
        action={<Button onClick={clearFilters}>Clear filters</Button>}
      />
    ) : (
      <EmptyState
        title={copy.tickets.emptyFirstTitle}
        body={copy.tickets.emptyFirstBody}
        action={
          <ButtonLink to="/tickets/new" variant="primary">
            Create ticket
          </ButtonLink>
        }
      />
    );
  } else {
    content = (
      <>
        <TicketTable tickets={data.data} showCreator={isAdmin} busy={query.isPlaceholderData} />
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onChange={(page) => update({ page })}
          label="Ticket pages"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All Tickets' : 'My Tickets'}
        description={
          isAdmin ? 'Triage, assign and resolve requests.' : 'Track the requests you have raised.'
        }
        actions={
          <ButtonLink to="/tickets/new" variant="primary">
            New ticket
          </ButtonLink>
        }
      />
      <Card aria-label="Ticket list">
        <div className={styles.toolbar}>
          {presets.length > 0 && (
            <div className={styles.presets} role="group" aria-label="Quick views">
              <span className={styles.presetsLabel} aria-hidden="true">
                Quick views
              </span>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.preset}
                  aria-pressed={sameParams(params, { ...base, ...preset.params })}
                  onClick={() => setSearchParams(toSearchParams({ ...base, ...preset.params }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          <TicketFilters params={params} onChange={update} />
        </div>
        <div className={styles.resultsBar}>
          <span role="status" aria-live="polite" className="tabular">
            {data ? `${data.meta.total} ${data.meta.total === 1 ? 'ticket' : 'tickets'}` : ''}
            {query.isFetching && data ? ' · Updating…' : ''}
          </span>
          {filtered && (
            <Button size="small" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        {content}
      </Card>
    </>
  );
}
