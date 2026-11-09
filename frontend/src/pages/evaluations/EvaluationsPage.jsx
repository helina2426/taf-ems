// The list of evaluations.
//   • Manager: their company's employee evaluations; can start new ones.
//   • Holding: all of them; approvers can also start Manager evaluations, and see what waits for approval.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { FormModal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { PeriodSelect } from '../../components/PeriodSelect.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCompanyOptions } from '../../hooks/useCompanyOptions.js';
import { defaultPeriodId, usePeriods } from '../../hooks/usePeriods.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { EVALUATION_STATUSES, STATUS_LABEL, STATUS_TONE, isApprover } from '../../utils/evaluations.js';
import { fieldError, formatDate, fullName, percent } from '../../utils/format.js';

export function EvaluationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHolding = user.role === 'HOLDING';
  const approver = isApprover(user);
  const canStart = user.role === 'MANAGER' || approver;

  const { periods } = usePeriods();
  const companies = useCompanyOptions({ onlyActive: false, enabled: isHolding });
  const [filters, setFilters] = useState({ periodId: '', status: '', type: '', companyId: '', page: 1 });
  const setFilter = (key, value) => setFilters({ ...filters, [key]: value, page: 1 });

  // When the periods arrive, choose the open one (or the latest) the first time.
  // (Only if nothing was chosen yet — never overwrite the user's own choice.)
  useEffect(() => {
    if (periods.length > 0) setFilters((f) => (f.periodId ? f : { ...f, periodId: defaultPeriodId(periods) }));
  }, [periods]);

  const { data, error, loading, reload } = useApi(filters.periodId ? '/evaluations' : null, { ...filters, pageSize: 50 });
  const [starting, setStarting] = useState(false);
  const period = periods.find((p) => p.id === filters.periodId);

  return (
    <div className="page">
      <PageHeader
        title="Evaluations"
        subtitle={isHolding ? 'Employee and Manager evaluations of all companies.' : `Evaluations of ${user.companyName}.`}
        actions={
          canStart && (
            <button className="btn btn-primary" onClick={() => setStarting(true)} disabled={period?.status !== 'OPEN'} title={period?.status !== 'OPEN' ? 'Choose an open period first' : ''}>
              + Start evaluation
            </button>
          )
        }
      />

      <div className="toolbar">
        <PeriodSelect periods={periods} value={filters.periodId} onChange={(v) => setFilter('periodId', v)} />
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {EVALUATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {isHolding && (
          <>
            <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type">
              <option value="">Employees and Managers</option>
              <option value="EMPLOYEE">Employee evaluations</option>
              <option value="MANAGER">Manager evaluations</option>
            </select>
            <select value={filters.companyId} onChange={(e) => setFilter('companyId', e.target.value)} aria-label="Company">
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        {approver && (
          <button className={`btn btn-small ${filters.status === 'SUBMITTED' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('status', filters.status === 'SUBMITTED' ? '' : 'SUBMITTED')}>
            Waiting for my approval
          </button>
        )}
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No evaluations match these filters.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>Person</th>
                {isHolding && <th>Company</th>}
                <th>Status</th>
                <th className="num">Score</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ev) => (
                <tr key={ev.id} onClick={() => navigate(`/evaluations/${ev.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/evaluations/${ev.id}`)}>
                  <td>
                    <div className="strong">{fullName(ev.employee)}</div>
                    <div className="muted small">
                      {ev.employee.employeeNumber} {ev.type === 'MANAGER' && <Badge tone="brand">Manager</Badge>}
                    </div>
                  </td>
                  {isHolding && <td>{ev.company.name}</td>}
                  <td>
                    <Badge tone={STATUS_TONE[ev.status]}>{STATUS_LABEL[ev.status]}</Badge>
                  </td>
                  <td className="num strong">{percent(ev.overallScore)}</td>
                  <td className="small">{formatDate(ev.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters({ ...filters, page })} />

      {starting && (
        <StartEvaluation
          period={period}
          existing={data?.items ?? []}
          onClose={() => setStarting(false)}
          onStarted={(id) => {
            reload();
            navigate(`/evaluations/${id}`);
          }}
        />
      )}
    </div>
  );
}

// Choose who to evaluate: a Manager picks one of their employees; an approver picks a Manager.
function StartEvaluation({ period, existing, onClose, onStarted }) {
  const { user } = useAuth();
  const forManagers = user.role === 'HOLDING';
  const people = useApi(forManagers ? '/managers' : '/employees', { pageSize: 100 });
  const [employeeId, setEmployeeId] = useState('');
  const { run, busy, error } = useSubmit();

  // Only people who can be evaluated and do not have an evaluation in this period yet.
  const already = new Set(existing.map((e) => e.employee.id));
  const items = people.data?.items ?? [];
  const options = forManagers
    ? items
        .filter((m) => m.isActive && m.employee && m.currentCompany && !already.has(m.employee.id))
        .map((m) => ({ id: m.employee.id, label: `${fullName(m.employee)} — ${m.currentCompany.name}` }))
    : items
        .filter((e) => ['ACTIVE', 'ON_LEAVE'].includes(e.employmentStatus) && !already.has(e.id))
        .map((e) => ({ id: e.id, label: `${fullName(e)} (${e.employeeNumber})` }));

  return (
    <FormModal title={`Start an evaluation — ${period?.name}`} formId="start-evaluation" busy={busy} onClose={onClose} submitLabel="Start">
      <form
        id="start-evaluation"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post('/evaluations', { employeeId, periodId: period.id }), (result) => onStarted(result.evaluation.id));
        }}
      >
        <ErrorAlert error={error} inForm />
        {people.loading ? (
          <Spinner />
        ) : (
          <Field label={forManagers ? 'Manager *' : 'Employee *'} error={fieldError(error, 'employeeId')}>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— Choose —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!people.loading && options.length === 0 && <p className="muted">Everyone already has an evaluation in this period.</p>}
      </form>
    </FormModal>
  );
}
