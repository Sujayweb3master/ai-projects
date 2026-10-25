import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback.jsx';
import { Select, TextField } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Card, PageHeader } from '../../components/ui/PageHeader.jsx';
import { copy, messageForError } from '../../domain/copy.js';
import { formatDate, ROLE_LABELS } from '../../domain/labels.js';
import { useAuthStore } from '../../stores/authStore.js';
import { toast } from '../../stores/toastStore.js';
import { useChangeActive, useChangeRole, useUserList } from './hooks.js';
import styles from './Users.module.css';

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function UserRow({ user, isSelf, onDeactivate, changeRole, changeActive }) {
  const [rowError, setRowError] = useState(null);

  // Role changes are reversible, so they apply immediately with Undo instead of a dialog.
  const setRole = (role, { undoable = true } = {}) => {
    const previous = user.role;
    setRowError(null);
    changeRole.mutate(
      { id: user.id, role },
      {
        onSuccess: () =>
          toast(`${user.name} is now ${ROLE_LABELS[role] === 'Admin' ? 'an Admin' : 'a User'}`, {
            action: undoable
              ? { label: 'Undo', onAction: () => setRole(previous, { undoable: false }) }
              : undefined,
          }),
        onError: (error) => setRowError(messageForError(error)),
      },
    );
  };

  const reactivate = () => {
    setRowError(null);
    changeActive.mutate(
      { id: user.id, isActive: true },
      {
        onSuccess: () => toast(`${user.name} reactivated`),
        onError: (error) => setRowError(messageForError(error)),
      },
    );
  };

  return (
    <tr>
      <td>
        <span className={styles.name}>
          <span className={user.isActive ? undefined : styles.inactive}>
            {user.name}
            {isSelf && ' (you)'}
          </span>
          <span className={styles.email}>{user.email}</span>
        </span>
        {rowError && (
          <span className={styles.rowError} role="alert">
            {rowError}
          </span>
        )}
      </td>
      <td>
        {isSelf ? (
          <Badge kind="role" value={user.role} />
        ) : (
          <>
            <label htmlFor={`role-${user.id}`} className="visually-hidden">
              Role for {user.name}
            </label>
            <select
              id={`role-${user.id}`}
              className={styles.roleSelect}
              value={user.role}
              disabled={changeRole.isPending}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </>
        )}
      </td>
      <td>
        <Badge kind="neutral" value={user.isActive ? 'active' : 'inactive'}>
          {user.isActive ? 'Active' : 'Deactivated'}
        </Badge>
      </td>
      <td className="tabular">{formatDate(user.createdAt)}</td>
      <td>
        {isSelf ? (
          <span className={styles.muted}>{copy.users.selfNote}</span>
        ) : user.isActive ? (
          <Button
            size="small"
            variant="danger"
            aria-label={`Deactivate ${user.name}`}
            onClick={() => onDeactivate(user)}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            size="small"
            aria-label={`Reactivate ${user.name}`}
            onClick={reactivate}
            loading={changeActive.isPending}
          >
            Reactivate
          </Button>
        )}
      </td>
    </tr>
  );
}

export function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const params = { q, role, isActive: active, page, pageSize: 20 };
  const users = useUserList(params);
  const changeRole = useChangeRole();
  const changeActive = useChangeActive();
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const confirmDeactivate = () =>
    changeActive.mutate(
      { id: pendingDeactivate.id, isActive: false },
      {
        onSuccess: () => {
          toast(`${pendingDeactivate.name} deactivated and signed out`);
          setPendingDeactivate(null);
        },
        onError: (error) => {
          toast(messageForError(error), { tone: 'error' });
          setPendingDeactivate(null);
        },
      },
    );

  return (
    <>
      <PageHeader title="Users" description="Manage roles and access. Changes apply immediately." />
      <Card aria-label="User list">
        <div className={styles.filters}>
          <TextField
            label="Search by name or email"
            type="search"
            required={false}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            autoComplete="off"
          />
          <Select label="Role" required={false} value={role} onChange={resetPage(setRole)}>
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </Select>
          <Select label="Status" required={false} value={active} onChange={resetPage(setActive)}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </Select>
        </div>
        {users.isPending && <Loading label="Loading users…" />}
        {users.isError && !users.data && (
          <ErrorState
            title="Couldn't load users"
            error={users.error}
            onRetry={() => users.refetch()}
          />
        )}
        {users.data &&
          (users.data.meta.total === 0 ? (
            <EmptyState
              icon="⌕"
              title="No users match"
              body="Try a different name, email or filter."
            />
          ) : (
            <>
              <div
                className={styles.tableRegion}
                role="region"
                aria-labelledby="users-caption"
                tabIndex={0}
              >
                <table className={styles.table} aria-busy={users.isPlaceholderData || undefined}>
                  <caption id="users-caption" className="visually-hidden">
                    Users ({users.data.meta.total})
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Joined</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.data.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isSelf={user.id === me.id}
                        onDeactivate={setPendingDeactivate}
                        changeRole={changeRole}
                        changeActive={changeActive}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={users.data.meta.page}
                totalPages={users.data.meta.totalPages}
                total={users.data.meta.total}
                onChange={setPage}
                label="User pages"
              />
            </>
          ))}
      </Card>
      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        title={pendingDeactivate ? copy.users.deactivateTitle(pendingDeactivate.name) : ''}
        body={copy.users.deactivateBody}
        confirmLabel={copy.users.deactivateConfirm}
        pending={changeActive.isPending}
        onConfirm={confirmDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      />
    </>
  );
}
