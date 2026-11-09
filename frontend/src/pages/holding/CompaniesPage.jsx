// Holding: the list of companies — create, edit, activate and deactivate.

import { useState } from 'react';
import { api } from '../../api/client.js';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, fullName } from '../../utils/format.js';

const EMPTY_FORM = { name: '', code: '', address: '', phone: '', email: '' };

export function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(''); // '' = all, 'true' = active, 'false' = inactive
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/companies', { search, isActive: status, page });

  const [editing, setEditing] = useState(null); // null = closed, {} = new, company = edit
  const [toggling, setToggling] = useState(null); // the company to activate / deactivate

  return (
    <div className="page">
      <PageHeader
        title="Companies"
        subtitle="The companies of the Holding."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + New company
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No companies found.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Manager</th>
                <th className="num">Employees</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((company) => (
                <tr key={company.id}>
                  <td>
                    <div className="strong">{company.name}</div>
                    <div className="muted small">{company.code}</div>
                  </td>
                  <td>{company.currentManager ? fullName(company.currentManager) : <span className="muted">No manager</span>}</td>
                  <td className="num">{company.employeeCount}</td>
                  <td>{company.isActive ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-small" onClick={() => setEditing(company)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => setToggling(company)}>
                      {company.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={setPage} />

      {editing && <CompanyForm company={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {toggling && <ToggleCompany company={toggling} onClose={() => setToggling(null)} onSaved={reload} />}
    </div>
  );
}

function CompanyForm({ company, onClose, onSaved }) {
  const isNew = !company.id;
  const [values, setValues] = useState(
    isNew ? EMPTY_FORM : Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, company[key] ?? ''])),
  );
  const { run, busy, error } = useSubmit();
  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

  function save(event) {
    event.preventDefault();
    run(
      () => (isNew ? api.post('/companies', values) : api.patch(`/companies/${company.id}`, values)),
      () => {
        onSaved();
        onClose();
      },
    );
  }

  return (
    <Modal
      title={isNew ? 'New company' : `Edit ${company.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="company-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="company-form" className="form-grid" onSubmit={save} noValidate>
        <ErrorAlert error={error} inForm />
        <Field label="Name *" error={fieldError(error, 'name')}>
          <input value={values.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Code *" error={fieldError(error, 'code')} hint="Short and unique, e.g. TAF-SOLAR">
          <input value={values.code} onChange={set('code')} />
        </Field>
        <Field label="Address" error={fieldError(error, 'address')}>
          <input value={values.address} onChange={set('address')} />
        </Field>
        <Field label="Phone" error={fieldError(error, 'phone')}>
          <input value={values.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email" error={fieldError(error, 'email')}>
          <input type="email" value={values.email} onChange={set('email')} />
        </Field>
      </form>
    </Modal>
  );
}

function ToggleCompany({ company, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const activate = !company.isActive;
  return (
    <ConfirmDialog
      title={activate ? 'Activate company' : 'Deactivate company'}
      message={
        activate
          ? `${company.name} will be active again, and its people can log in.`
          : `Nobody from ${company.name} will be able to log in. Nothing is deleted, and you can activate it again later.`
      }
      confirmLabel={activate ? 'Activate' : 'Deactivate'}
      danger={!activate}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(
          () => api.patch(`/companies/${company.id}/status`, { isActive: activate }),
          () => {
            onSaved();
            onClose();
          },
        )
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}
