// Holding: Manager accounts — create, edit, assign to a company, unassign, activate and deactivate.
// Rules from the backend: one active Manager per company, one company per Manager.

import { useState } from 'react';
import { api } from '../../api/client.js';
import { ConfirmDialog, FormModal, Modal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCompanyOptions } from '../../hooks/useCompanyOptions.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate, fullName, withoutEmpty } from '../../utils/format.js';

export function ManagersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/managers', { search, page });

  // Which window is open: { type: 'create' | 'edit' | 'assign' | 'unassign' | 'status' | 'history', manager }
  const [dialog, setDialog] = useState(null);
  const open = (type, manager) => setDialog({ type, manager });
  const close = () => setDialog(null);

  return (
    <div className="page">
      <PageHeader
        title="Managers"
        subtitle="Each company has at most one active Manager, and a Manager runs one company."
        actions={
          <button className="btn btn-primary" onClick={() => open('create')}>
            + New manager
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No managers found.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Company</th>
                <th>Account</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="strong">{fullName(m.employee)}</div>
                    <div className="muted small">{m.email}</div>
                  </td>
                  <td>
                    {m.currentCompany ? (
                      <>
                        <div>{m.currentCompany.name}</div>
                        <div className="muted small">since {formatDate(m.currentCompany.assignedAt)}</div>
                      </>
                    ) : (
                      <Badge tone="warn">Not assigned</Badge>
                    )}
                  </td>
                  <td>
                    {m.isActive ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}{' '}
                    {m.mustChangePassword && <Badge tone="info">First login pending</Badge>}
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-small" onClick={() => open('edit', m)}>
                      Edit
                    </button>
                    {/* A Manager runs one company: to move them, unassign first, then assign again. */}
                    {!m.currentCompany && (
                      <button className="btn btn-ghost btn-small" onClick={() => open('assign', m)} disabled={!m.isActive}>
                        Assign
                      </button>
                    )}
                    {m.currentCompany && (
                      <button className="btn btn-ghost btn-small" onClick={() => open('unassign', m)}>
                        Unassign
                      </button>
                    )}
                    <button className="btn btn-ghost btn-small" onClick={() => open('status', m)}>
                      {m.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => open('history', m)}>
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={setPage} />

      {dialog?.type === 'create' && <CreateManager onClose={close} onSaved={reload} />}
      {dialog?.type === 'edit' && <EditManager manager={dialog.manager} onClose={close} onSaved={reload} />}
      {dialog?.type === 'assign' && <AssignManager manager={dialog.manager} onClose={close} onSaved={reload} />}
      {dialog?.type === 'unassign' && <UnassignManager manager={dialog.manager} onClose={close} onSaved={reload} />}
      {dialog?.type === 'status' && <ManagerStatus manager={dialog.manager} onClose={close} onSaved={reload} />}
      {dialog?.type === 'history' && <ManagerHistory manager={dialog.manager} onClose={close} />}
    </div>
  );
}

// The drop-down of companies. Shows who currently runs each one, so replacing a Manager is a conscious choice.
function CompanySelect({ value, onChange, error }) {
  const companies = useCompanyOptions();
  return (
    <Field label="Company *" error={error} hint="If the company already has a Manager, the new one replaces them.">
      <select value={value} onChange={onChange}>
        <option value="">— Choose a company —</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.currentManager ? ` (now: ${fullName(c.currentManager)})` : ' (no manager)'}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CreateManager({ onClose, onSaved }) {
  const [v, setV] = useState({
    email: '', temporaryPassword: '', firstName: '', lastName: '', employeeNumber: '', jobTitle: '', department: '', phone: '', companyId: '',
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();

  return (
    <FormModal title="New manager" formId="create-manager" busy={busy} onClose={onClose} submitLabel="Create">
      <form
        id="create-manager"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post('/managers', withoutEmpty(v)), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label="First name *" error={fieldError(error, 'firstName')}>
          <input value={v.firstName} onChange={set('firstName')} autoFocus />
        </Field>
        <Field label="Last name *" error={fieldError(error, 'lastName')}>
          <input value={v.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Email *" error={fieldError(error, 'email')}>
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Temporary password *" error={fieldError(error, 'temporaryPassword')} hint="They must change it at first login.">
          <input value={v.temporaryPassword} onChange={set('temporaryPassword')} autoComplete="off" />
        </Field>
        <Field label="Employee number *" error={fieldError(error, 'employeeNumber')}>
          <input value={v.employeeNumber} onChange={set('employeeNumber')} />
        </Field>
        <Field label="Job title" error={fieldError(error, 'jobTitle')}>
          <input value={v.jobTitle} onChange={set('jobTitle')} />
        </Field>
        <Field label="Department" error={fieldError(error, 'department')}>
          <input value={v.department} onChange={set('department')} />
        </Field>
        <Field label="Phone" error={fieldError(error, 'phone')}>
          <input value={v.phone} onChange={set('phone')} />
        </Field>
        <CompanySelect value={v.companyId} onChange={set('companyId')} error={fieldError(error, 'companyId')} />
      </form>
    </FormModal>
  );
}

function EditManager({ manager, onClose, onSaved }) {
  const e0 = manager.employee ?? {};
  const [v, setV] = useState({
    email: manager.email, firstName: e0.firstName ?? '', lastName: e0.lastName ?? '', jobTitle: e0.jobTitle ?? '', department: e0.department ?? '', phone: e0.phone ?? '',
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();

  return (
    <FormModal title={`Edit ${fullName(manager.employee)}`} formId="edit-manager" busy={busy} onClose={onClose}>
      <form
        id="edit-manager"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.patch(`/managers/${manager.id}`, v), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label="First name" error={fieldError(error, 'firstName')}>
          <input value={v.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Last name" error={fieldError(error, 'lastName')}>
          <input value={v.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Email" error={fieldError(error, 'email')}>
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Job title" error={fieldError(error, 'jobTitle')}>
          <input value={v.jobTitle} onChange={set('jobTitle')} />
        </Field>
        <Field label="Department" error={fieldError(error, 'department')}>
          <input value={v.department} onChange={set('department')} />
        </Field>
        <Field label="Phone" error={fieldError(error, 'phone')}>
          <input value={v.phone} onChange={set('phone')} />
        </Field>
      </form>
    </FormModal>
  );
}

function AssignManager({ manager, onClose, onSaved }) {
  const [companyId, setCompanyId] = useState('');
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={`Assign ${fullName(manager.employee)}`} formId="assign-manager" busy={busy} onClose={onClose} submitLabel="Assign">
      <form
        id="assign-manager"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.put(`/managers/${manager.id}/assignment`, { companyId }), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <CompanySelect value={companyId} onChange={(e) => setCompanyId(e.target.value)} error={fieldError(error, 'companyId')} />
      </form>
    </FormModal>
  );
}

function UnassignManager({ manager, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  return (
    <ConfirmDialog
      title="Unassign manager"
      message={`${fullName(manager.employee)} will no longer run ${manager.currentCompany.name}. The company will have no Manager until you assign one.`}
      confirmLabel="Unassign"
      danger
      busy={busy}
      onClose={onClose}
      onConfirm={() => run(() => api.delete(`/managers/${manager.id}/assignment`), () => { onSaved(); onClose(); })}
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function ManagerStatus({ manager, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const activate = !manager.isActive;
  return (
    <ConfirmDialog
      title={activate ? 'Activate manager' : 'Deactivate manager'}
      message={activate ? `${fullName(manager.employee)} will be able to log in again.` : `${fullName(manager.employee)} will no longer be able to log in. Nothing is deleted.`}
      confirmLabel={activate ? 'Activate' : 'Deactivate'}
      danger={!activate}
      busy={busy}
      onClose={onClose}
      onConfirm={() => run(() => api.patch(`/managers/${manager.id}/status`, { isActive: activate }), () => { onSaved(); onClose(); })}
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function ManagerHistory({ manager, onClose }) {
  const { data, error, loading } = useApi(`/managers/${manager.id}`);
  const history = data?.manager.assignmentHistory ?? [];
  return (
    <Modal title={`Companies run by ${fullName(manager.employee)}`} onClose={onClose}>
      {loading && <Spinner />}
      <ErrorAlert error={error} />
      {data && history.length === 0 && <EmptyState>Never assigned to a company.</EmptyState>}
      {history.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>From</th>
              <th>To</th>
              <th>Assigned by</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td>{h.company.name}</td>
                <td>{formatDate(h.startDate)}</td>
                <td>{h.endDate ? formatDate(h.endDate) : <Badge tone="good">Now</Badge>}</td>
                <td className="small">{h.assignedBy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
