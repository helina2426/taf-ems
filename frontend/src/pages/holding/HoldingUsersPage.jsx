// Holding users. Everyone in the Holding can see the list.
// Only the PRIMARY Holding user can add accounts, allow or stop approving, and deactivate.
// (The backend enforces this too — the buttons are only hidden to keep the page clear.)

import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { ConfirmDialog, FormModal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDateTime } from '../../utils/format.js';

export function HoldingUsersPage() {
  const { user } = useAuth();
  const isPrimary = user.isPrimaryHoldingUser;
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/holding-users', { page });
  const [dialog, setDialog] = useState(null); // { type: 'create' | 'permission' | 'status', target }
  const close = () => setDialog(null);

  return (
    <div className="page">
      <PageHeader
        title="Holding users"
        subtitle="People who work at the Holding level."
        actions={
          isPrimary && (
            <button className="btn btn-primary" onClick={() => setDialog({ type: 'create' })}>
              + New Holding user
            </button>
          )
        }
      />
      {!isPrimary && <Alert type="info">Only the primary Holding user can add accounts or change who may approve evaluations.</Alert>}

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Can approve evaluations</th>
                <th>Account</th>
                <th>Last login</th>
                {isPrimary && <th />}
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="strong">{u.email}</div>
                    {u.isPrimaryHoldingUser && <Badge tone="info">Primary</Badge>}
                  </td>
                  <td>{u.canApproveEvaluations ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>}</td>
                  <td>
                    {u.isActive ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}{' '}
                    {u.mustChangePassword && <Badge tone="info">First login pending</Badge>}
                  </td>
                  <td className="small">{formatDateTime(u.lastLoginAt)}</td>
                  {isPrimary && (
                    <td className="row-actions">
                      {!u.isPrimaryHoldingUser && (
                        <>
                          <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'permission', target: u })}>
                            {u.canApproveEvaluations ? 'Stop approving' : 'Allow approving'}
                          </button>
                          <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'status', target: u })}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={setPage} />

      {dialog?.type === 'create' && <CreateHoldingUser onClose={close} onSaved={reload} />}
      {dialog?.type === 'permission' && <PermissionDialog target={dialog.target} onClose={close} onSaved={reload} />}
      {dialog?.type === 'status' && <StatusDialog target={dialog.target} onClose={close} onSaved={reload} />}
    </div>
  );
}

function CreateHoldingUser({ onClose, onSaved }) {
  const [v, setV] = useState({ email: '', temporaryPassword: '', canApproveEvaluations: false });
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title="New Holding user" formId="holding-user-form" busy={busy} onClose={onClose} submitLabel="Create">
      <form
        id="holding-user-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post('/holding-users', v), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label="Email *" error={fieldError(error, 'email')}>
          <input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoFocus />
        </Field>
        <Field label="Temporary password *" error={fieldError(error, 'temporaryPassword')} hint="They must change it at first login.">
          <input value={v.temporaryPassword} onChange={(e) => setV({ ...v, temporaryPassword: e.target.value })} autoComplete="off" />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={v.canApproveEvaluations} onChange={(e) => setV({ ...v, canApproveEvaluations: e.target.checked })} />
          Allow this person to approve and publish evaluations
        </label>
      </form>
    </FormModal>
  );
}

function PermissionDialog({ target, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const allow = !target.canApproveEvaluations;
  return (
    <ConfirmDialog
      title={allow ? 'Allow approving' : 'Stop approving'}
      message={
        allow
          ? `${target.email} will be able to approve, return and publish evaluations (but never one they submitted themselves).`
          : `${target.email} will no longer be able to approve or publish evaluations.`
      }
      confirmLabel={allow ? 'Allow' : 'Stop'}
      danger={!allow}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/holding-users/${target.id}/approval-permission`, { canApproveEvaluations: allow }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function StatusDialog({ target, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const activate = !target.isActive;
  return (
    <ConfirmDialog
      title={activate ? 'Activate account' : 'Deactivate account'}
      message={activate ? `${target.email} will be able to log in again.` : `${target.email} will no longer be able to log in. Nothing is deleted.`}
      confirmLabel={activate ? 'Activate' : 'Deactivate'}
      danger={!activate}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/holding-users/${target.id}/status`, { isActive: activate }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}
