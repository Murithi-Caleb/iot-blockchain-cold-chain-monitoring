import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { getSession, ROLES, ROLE_LABELS } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import DashboardLayout from './layout/DashboardLayout';
import PageHeader from './ui/PageHeader';
import { Panel, StatCard } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import DataTable from './ui/DataTable';
import FormField from './ui/FormField';
import ConfirmDialog from './ui/ConfirmDialog';
import { EmptyState, LoadingState, Notice } from './ui/Feedback';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { heading: 'Planned modules' },
  { id: 'devices', label: 'Devices', planned: true },
  { id: 'activity', label: 'System Activity', planned: true },
  { id: 'settings', label: 'Settings', planned: true }
];

// Roles an administrator can pick when provisioning a new account (unchanged from the
// original form). Existing accounts may also be changed to any role from the table.
const PROVISIONABLE_ROLES = [ROLES.OPERATOR, ROLES.TRACEABILITY];

export default function AdminDashboard() {
  const session = useMemo(() => getSession(), []);
  const [view, setView] = useState('overview');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [batchCount, setBatchCount] = useState(null);

  const [feedback, setFeedback] = useState(null); // { variant, text }
  const [busyUid, setBusyUid] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.data || []);
    } catch (error) {
      setUsersError(getErrorMessage(error, 'Could not load users.'));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    // Batch total for the overview card. Failure is non-critical: the card then
    // simply shows as unavailable.
    api.get('/api/batches')
      .then((response) => setBatchCount((response.data.data || []).length))
      .catch(() => setBatchCount(null));
  }, [loadUsers]);

  const counts = useMemo(() => ({
    total: users.length,
    operators: users.filter((user) => user.role === ROLES.OPERATOR).length,
    traceability: users.filter((user) => user.role === ROLES.TRACEABILITY).length,
    admins: users.filter((user) => user.role === ROLES.ADMIN).length,
    disabled: users.filter((user) => user.disabled).length
  }), [users]);

  const recentSignIns = useMemo(() =>
    users
      .filter((user) => user.last_sign_in_at)
      .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
      .slice(0, 6),
  [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'all' && (user.role || 'none') !== roleFilter) return false;
      if (!query) return true;
      return `${user.email || ''} ${user.display_name || ''}`.toLowerCase().includes(query);
    });
  }, [users, search, roleFilter]);

  // Runs a user mutation, reports the outcome and refreshes the list.
  const runUserAction = async (uid, action, successText) => {
    setBusyUid(uid);
    setFeedback(null);
    try {
      await action();
      setFeedback({ variant: 'success', text: successText });
      await loadUsers();
    } catch (error) {
      setFeedback({ variant: 'danger', text: getErrorMessage(error, 'The change could not be applied.') });
    } finally {
      setBusyUid(null);
    }
  };

  const changeRole = (user, role) =>
    runUserAction(
      user.uid,
      () => api.patch(`/api/admin/users/${user.uid}`, { role }),
      `${user.email} is now ${ROLE_LABELS[role]}. They must sign in again for the change to take effect.`
    );

  const toggleDisabled = (user) =>
    runUserAction(
      user.uid,
      () => api.patch(`/api/admin/users/${user.uid}`, { disabled: !user.disabled }),
      `${user.email} was ${user.disabled ? 'enabled' : 'disabled'}.`
    );

  const confirmDelete = async () => {
    const target = pendingDelete;
    await runUserAction(
      target.uid,
      () => api.delete(`/api/admin/users/${target.uid}`),
      `${target.email} was deleted.`
    );
    setPendingDelete(null);
  };

  const userColumns = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <>
          <div className="table__primary">{user.display_name || '—'}</div>
          <div className="table__secondary">{user.email}</div>
        </>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <select
          className="input"
          aria-label={`Role for ${user.email}`}
          value={user.role || ''}
          disabled={busyUid === user.uid || user.uid === session?.uid}
          onChange={(e) => changeRole(user, e.target.value)}
        >
          {!user.role && <option value="" disabled>No role</option>}
          {Object.values(ROLES).map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        user.disabled
          ? <StatusBadge variant="danger">Disabled</StatusBadge>
          : <StatusBadge variant="ok">Active</StatusBadge>
      )
    },
    { key: 'last', header: 'Last sign-in', className: 'nowrap', render: (user) => formatDateTime(user.last_sign_in_at) },
    {
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      render: (user) => {
        const isSelf = user.uid === session?.uid;
        const busy = busyUid === user.uid;
        return (
          <div className="table__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy || isSelf}
              onClick={() => toggleDisabled(user)}
            >
              {user.disabled ? 'Enable' : 'Disable'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy || isSelf}
              onClick={() => setPendingDelete(user)}
            >
              Delete
            </button>
          </div>
        );
      }
    }
  ];

  const feedbackNotice = feedback && (
    <Notice variant={feedback.variant} onDismiss={() => setFeedback(null)}>{feedback.text}</Notice>
  );

  return (
    <DashboardLayout
      workspaceName="Administration"
      navItems={NAV_ITEMS}
      activeId={view}
      onNavigate={setView}
    >
      {view === 'overview' && (
        <>
          <PageHeader
            title="Administration dashboard"
            description="Overview of provisioned accounts and recent account activity."
            actions={
              <button type="button" className="btn btn--primary" onClick={() => setView('users')}>
                Manage users
              </button>
            }
          />
          <div className="stack">
            {usersError && <Notice variant="danger">{usersError}</Notice>}
            <div className="stat-grid">
              <StatCard label="Total users" value={usersLoading ? '…' : counts.total} meta={`${counts.admins} administrator${counts.admins === 1 ? '' : 's'}`} />
              <StatCard label="Operators" value={usersLoading ? '…' : counts.operators} meta="Supply chain operators" />
              <StatCard label="Traceability users" value={usersLoading ? '…' : counts.traceability} meta="Authorized lookup accounts" />
              <StatCard label="Produce batches" value={batchCount} meta={batchCount === null ? '' : 'Registered in the system'} />
              <StatCard label="Registered devices" value={null} meta="Device registration is planned" />
            </div>

            <Panel
              title="Recent sign-ins"
              description="From Firebase Authentication. A persistent system activity log is a planned module."
            >
              {usersLoading ? (
                <LoadingState label="Loading account activity…" />
              ) : recentSignIns.length === 0 ? (
                <EmptyState title="No sign-ins recorded yet" />
              ) : (
                <DataTable
                  caption="Most recent account sign-ins"
                  rows={recentSignIns}
                  getRowKey={(user) => user.uid}
                  columns={[
                    { key: 'email', header: 'Account', render: (user) => <span className="table__primary">{user.email}</span> },
                    { key: 'role', header: 'Role', render: (user) => ROLE_LABELS[user.role] || 'No role' },
                    { key: 'last', header: 'Signed in', className: 'nowrap', render: (user) => formatDateTime(user.last_sign_in_at) }
                  ]}
                />
              )}
            </Panel>
          </div>
        </>
      )}

      {view === 'users' && (
        <>
          <PageHeader
            title="Users and roles"
            description="Provision accounts for supply chain operators and traceability users, and manage existing access."
          />
          <div className="stack">
            {feedbackNotice}

            <CreateUserPanel
              onCreated={async (email, role) => {
                setFeedback({ variant: 'success', text: `Account created for ${email} as ${ROLE_LABELS[role]}.` });
                await loadUsers();
              }}
              onFailed={(text) => setFeedback({ variant: 'danger', text })}
            />

            <Panel title="Accounts" flush>
              <div className="toolbar">
                <FormField
                  id="user-search"
                  label="Search"
                  type="search"
                  placeholder="Name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <FormField
                  id="user-role-filter"
                  label="Role"
                  as="select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All roles</option>
                  {Object.values(ROLES).map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                  <option value="none">No role</option>
                </FormField>
              </div>
              {usersLoading ? (
                <LoadingState label="Loading users…" />
              ) : usersError ? (
                <EmptyState
                  title="Users could not be loaded"
                  action={<button type="button" className="btn btn--secondary" onClick={loadUsers}>Try again</button>}
                >
                  {usersError}
                </EmptyState>
              ) : (
                <DataTable
                  caption="User accounts"
                  columns={userColumns}
                  rows={filteredUsers}
                  getRowKey={(user) => user.uid}
                  emptyMessage={users.length === 0 ? 'No accounts exist yet.' : 'No accounts match the current filters.'}
                />
              )}
            </Panel>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this account?"
        confirmLabel="Delete account"
        danger
        busy={busyUid !== null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        <p>
          <strong>{pendingDelete?.email}</strong> will be permanently removed and can no longer sign in.
          This cannot be undone.
        </p>
      </ConfirmDialog>
    </DashboardLayout>
  );
}

// Provisioning form. Posts to the existing POST /api/admin/users endpoint; the
// backend requires a 12 to 128 character password and a display name.
function CreateUserPanel({ onCreated, onFailed }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES.OPERATOR);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/admin/users', {
        email: email.trim(),
        display_name: displayName.trim(),
        password,
        role
      });
      const createdEmail = email.trim();
      setEmail('');
      setDisplayName('');
      setPassword('');
      await onCreated(createdEmail, role);
    } catch (error) {
      onFailed(getErrorMessage(error, 'The account could not be created.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel title="Provision a user account" description="The user signs in with this email and the temporary password, then should change it.">
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-grid">
          <FormField
            id="new-user-email"
            label="Email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            id="new-user-name"
            label="Display name"
            maxLength={128}
            autoComplete="off"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <FormField
            id="new-user-password"
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            hint="12 to 128 characters."
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormField
            id="new-user-role"
            label="System role"
            as="select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {PROVISIONABLE_ROLES.map((value) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </FormField>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
