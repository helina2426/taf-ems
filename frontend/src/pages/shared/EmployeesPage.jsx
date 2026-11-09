// Employees — used by two roles:
//   • Holding: every company (with a company filter), and can transfer people between companies.
//   • Manager: "My team" — only their own company (the backend enforces this, whatever the browser sends).

import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { ConfirmDialog, FormModal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCompanyOptions } from '../../hooks/useCompanyOptions.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, fullName, humanize, withoutEmpty } from '../../utils/format.js';

const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'];
const STATUS_TONE = { ACTIVE: 'good', ON_LEAVE: 'info', SUSPENDED: 'warn', TERMINATED: 'bad' };

export function EmployeesPage() {
  const { user } = useAuth();
  const isHolding = user.role === 'HOLDING';

  const [filters, setFilters] = useState({ search: '', employmentStatus: '', companyId: '', page: 1 });
  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });
  const { data, error, loading, reload } = useApi('/employees', filters);
  const companies = useCompanyOptions({ onlyActive: false, enabled: isHolding });

  const [dialog, setDialog] = useState(null); // { type: 'create' | 'edit' | 'status' | 'transfer', employee }
  const close = () => setDialog(null);

  return (
    <div className="page">
      <PageHeader
        title={isHolding ? 'Employees' : 'My team'}
        subtitle={isHolding ? 'Employees of all companies.' : `Employees of ${user.companyName}.`}
        actions={
          <button className="btn btn-primary" onClick={() => setDialog({ type: 'create' })}>
            + New employee
          </button>
        }
      />

      <div className="toolbar">
        <input className="search" placeholder="Search by name, number or email…" value={filters.search} onChange={setFilter('search')} />
        <select value={filters.employmentStatus} onChange={setFilter('employmentStatus')}>
          <option value="">All statuses</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        {isHolding && (
          <select value={filters.companyId} onChange={setFilter('companyId')}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No employees found.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job</th>
                {isHolding && <th>Company</th>}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="strong">{fullName(emp)}</div>
                    <div className="muted small">
                      {emp.employeeNumber} · {emp.email}
                    </div>
                  </td>
                  <td>
                    <div>{emp.jobTitle ?? '—'}</div>
                    <div className="muted small">{emp.department ?? ''}</div>
                  </td>
                  {isHolding && <td>{emp.company.name}</td>}
                  <td>
                    <Badge tone={STATUS_TONE[emp.employmentStatus]}>{humanize(emp.employmentStatus)}</Badge>{' '}
                    {emp.mustChangePassword && <Badge tone="info">First login pending</Badge>}
                  </td>
                  <td className="row-actions">
                    <Link className="btn btn-ghost btn-small" to={`/reports/employees/${emp.id}`}>
                      Report
                    </Link>
                    <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'edit', employee: emp })}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'status', employee: emp })}>
                      Status
                    </button>
                    {isHolding && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'transfer', employee: emp })}>
                        Transfer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters({ ...filters, page })} />

      {dialog?.type === 'create' && <EmployeeForm isHolding={isHolding} companies={companies} onClose={close} onSaved={reload} />}
      {dialog?.type === 'edit' && <EmployeeForm employee={dialog.employee} onClose={close} onSaved={reload} />}
      {dialog?.type === 'status' && <StatusForm employee={dialog.employee} onClose={close} onSaved={reload} />}
      {dialog?.type === 'transfer' && <TransferForm employee={dialog.employee} companies={companies} onClose={close} onSaved={reload} />}
    </div>
  );
}

const PROFILE_FIELDS = ['employeeNumber', 'firstName', 'lastName', 'jobTitle', 'department', 'phone', 'address', 'emergencyContact', 'hireDate'];

function EmployeeForm({ employee, isHolding, companies = [], onClose, onSaved }) {
  const isNew = !employee;
  const [v, setV] = useState(
    isNew
      ? { email: '', temporaryPassword: '', companyId: '', ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, ''])) }
      : { email: employee.email, ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, employee[k] ?? ''])) },
  );
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();
  const err = (key) => fieldError(error, key);

  function save(event) {
    event.preventDefault();
    // New: leave out empty optional fields. Edit: send everything, so a field can also be cleared.
    const body = isNew ? withoutEmpty(v) : v;
    run(() => (isNew ? api.post('/employees', body) : api.patch(`/employees/${employee.id}`, body)), () => {
      onSaved();
      onClose();
    });
  }

  return (
    <FormModal title={isNew ? 'New employee' : `Edit ${fullName(employee)}`} formId="employee-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Create' : 'Save'} wide>
      <form id="employee-form" className="form-grid form-grid-2" onSubmit={save} noValidate>
        <div className="span-2">
          <ErrorAlert error={error} inForm />
        </div>
        <Field label="First name *" error={err('firstName')}>
          <input value={v.firstName} onChange={set('firstName')} autoFocus />
        </Field>
        <Field label="Last name *" error={err('lastName')}>
          <input value={v.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Email *" error={err('email')}>
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        {isNew && (
          <Field label="Temporary password *" error={err('temporaryPassword')} hint="They must change it at first login.">
            <input value={v.temporaryPassword} onChange={set('temporaryPassword')} autoComplete="off" />
          </Field>
        )}
        <Field label="Employee number *" error={err('employeeNumber')}>
          <input value={v.employeeNumber} onChange={set('employeeNumber')} />
        </Field>
        {isNew && isHolding && (
          <Field label="Company *" error={err('companyId')}>
            <select value={v.companyId} onChange={set('companyId')}>
              <option value="">— Choose —</option>
              {companies.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Job title" error={err('jobTitle')}>
          <input value={v.jobTitle} onChange={set('jobTitle')} />
        </Field>
        <Field label="Department" error={err('department')}>
          <input value={v.department} onChange={set('department')} />
        </Field>
        <Field label="Phone" error={err('phone')}>
          <input value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="Hire date" error={err('hireDate')}>
          <input type="date" value={v.hireDate} onChange={set('hireDate')} />
        </Field>
        <Field label="Address" error={err('address')}>
          <input value={v.address} onChange={set('address')} />
        </Field>
        <Field label="Emergency contact" error={err('emergencyContact')}>
          <input value={v.emergencyContact} onChange={set('emergencyContact')} />
        </Field>
      </form>
    </FormModal>
  );
}

function StatusForm({ employee, onClose, onSaved }) {
  const [status, setStatus] = useState(employee.employmentStatus);
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={`Status of ${fullName(employee)}`} formId="status-form" busy={busy} onClose={onClose}>
      <form
        id="status-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.patch(`/employees/${employee.id}/status`, { employmentStatus: status }), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label="Employment status" hint="Suspended and terminated employees cannot log in. Nothing is deleted.">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </FormModal>
  );
}

function TransferForm({ employee, companies, onClose, onSaved }) {
  const [companyId, setCompanyId] = useState('');
  const { run, busy, error } = useSubmit();
  const target = companies.find((c) => c.id === companyId);
  return (
    <ConfirmDialog
      title={`Transfer ${fullName(employee)}`}
      message={`Now in ${employee.company.name}. Old evaluations stay with the old company; the new company's Manager takes over from now on.`}
      confirmLabel={target ? `Transfer to ${target.name}` : 'Transfer'}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.put(`/employees/${employee.id}/company`, { companyId }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} inForm />
      <Field label="New company" error={fieldError(error, 'companyId')}>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">— Choose —</option>
          {companies
            .filter((c) => c.isActive && c.id !== employee.company.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
    </ConfirmDialog>
  );
}

