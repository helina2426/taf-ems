// Holding: evaluation periods and the criteria (with their weights).
//
// Rules from the backend (shown on the page so nobody is surprised):
//   • A period goes UPCOMING → OPEN → CLOSED (and can be reopened for late corrections).
//   • A period can only be opened when each criteria list adds up to exactly 100%.
//   • Criteria cannot be changed while a period is open (scores already given would no longer match).

import { useState } from 'react';
import { api } from '../../api/client.js';
import { ConfirmDialog, FormModal } from '../../components/Modal.jsx';
import { Alert, Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate } from '../../utils/format.js';

const PERIOD_TONE = { UPCOMING: 'info', OPEN: 'good', CLOSED: 'neutral' };

export function EvaluationSetupPage() {
  const periods = useApi('/evaluation-periods');
  const criteria = useApi('/evaluation-criteria');
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  const reloadAll = () => {
    periods.reload();
    criteria.reload();
  };

  const periodList = [...(periods.data?.items ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const openPeriod = periodList.find((p) => p.status === 'OPEN');

  return (
    <div className="page">
      <PageHeader title="Periods & criteria" subtitle="When evaluations happen, and what people are scored on." />

      {/* ---------- Periods ---------- */}
      <div className="section-head">
        <h2 className="section-title">Evaluation periods</h2>
        <button className="btn btn-primary" onClick={() => setDialog({ type: 'period' })}>
          + New period
        </button>
      </div>
      {periods.loading && !periods.data && <Spinner />}
      <ErrorAlert error={periods.error} />
      {periods.data && periodList.length === 0 && <EmptyState>No periods yet.</EmptyState>}
      {periodList.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="num">Evaluations</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {periodList.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.name}</td>
                  <td className="small">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </td>
                  <td>
                    <Badge tone={PERIOD_TONE[p.status]}>{p.status === 'OPEN' ? 'Open' : p.status === 'UPCOMING' ? 'Upcoming' : 'Closed'}</Badge>
                  </td>
                  <td className="num">{p.counts.evaluations}</td>
                  <td className="row-actions">
                    {p.status !== 'CLOSED' && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'period', period: p })}>
                        Edit
                      </button>
                    )}
                    {p.status === 'UPCOMING' && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'status', period: p, to: 'OPEN' })}>
                        Open
                      </button>
                    )}
                    {p.status === 'OPEN' && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'status', period: p, to: 'CLOSED' })}>
                        Close
                      </button>
                    )}
                    {p.status === 'CLOSED' && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'status', period: p, to: 'OPEN' })}>
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Criteria ---------- */}
      <div className="section-head">
        <h2 className="section-title">Criteria</h2>
        <button className="btn btn-primary" onClick={() => setDialog({ type: 'criterion' })} disabled={Boolean(openPeriod)}>
          + New criterion
        </button>
      </div>
      {openPeriod && (
        <Alert type="info">
          Criteria are locked while "{openPeriod.name}" is open. Close the period to change them.
        </Alert>
      )}
      {criteria.loading && !criteria.data && <Spinner />}
      <ErrorAlert error={criteria.error} />
      {criteria.data && (
        <div className="two-columns">
          {['EMPLOYEE', 'MANAGER'].map((list) => (
            <CriteriaList
              key={list}
              list={list}
              items={criteria.data.items.filter((c) => c.appliesTo === list)}
              total={criteria.data.totals[list]}
              locked={Boolean(openPeriod)}
              onEdit={(c) => setDialog({ type: 'criterion', criterion: c })}
              onToggle={(c) => setDialog({ type: 'criterionStatus', criterion: c })}
            />
          ))}
        </div>
      )}

      {dialog?.type === 'period' && <PeriodForm period={dialog.period} onClose={close} onSaved={reloadAll} />}
      {dialog?.type === 'status' && <PeriodStatus period={dialog.period} to={dialog.to} onClose={close} onSaved={reloadAll} />}
      {dialog?.type === 'criterion' && <CriterionForm criterion={dialog.criterion} onClose={close} onSaved={reloadAll} />}
      {dialog?.type === 'criterionStatus' && <CriterionStatus criterion={dialog.criterion} onClose={close} onSaved={reloadAll} />}
    </div>
  );
}

function CriteriaList({ list, items, total, locked, onEdit, onToggle }) {
  const sorted = [...items].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.weight - a.weight);
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{list === 'EMPLOYEE' ? 'For employees' : 'For managers'}</h3>
        {total?.isComplete ? (
          <Badge tone="good">Total 100% ✓</Badge>
        ) : (
          <Badge tone="warn">Total {total?.activeWeightTotal ?? 0}% — must be 100%</Badge>
        )}
      </div>
      {sorted.length === 0 && <p className="muted">No criteria yet.</p>}
      <ul className="criteria-list">
        {sorted.map((c) => (
          <li key={c.id} className={c.isActive ? '' : 'inactive'}>
            <div>
              <div className="strong">
                {c.name} {!c.isActive && <Badge>Inactive</Badge>}
              </div>
              {c.description && <div className="muted small">{c.description}</div>}
            </div>
            <div className="criteria-weight">{c.weight}%</div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={() => onEdit(c)} disabled={locked}>
                Edit
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => onToggle(c)} disabled={locked}>
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeriodForm({ period, onClose, onSaved }) {
  const isNew = !period;
  const [v, setV] = useState({ name: period?.name ?? '', startDate: period?.startDate ?? '', endDate: period?.endDate ?? '' });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={isNew ? 'New evaluation period' : `Edit ${period.name}`} formId="period-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Create' : 'Save'}>
      <form
        id="period-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (isNew ? api.post('/evaluation-periods', v) : api.patch(`/evaluation-periods/${period.id}`, v)), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label="Name *" error={fieldError(error, 'name')} hint='For example "2027 Annual Evaluation".'>
          <input value={v.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Start date *" error={fieldError(error, 'startDate')}>
          <input type="date" value={v.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="End date *" error={fieldError(error, 'endDate')}>
          <input type="date" value={v.endDate} onChange={set('endDate')} />
        </Field>
        {isNew && <p className="muted small">A new period starts as "Upcoming". Open it when evaluations should begin.</p>}
      </form>
    </FormModal>
  );
}

function PeriodStatus({ period, to, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const messages = {
    OPEN:
      period.status === 'CLOSED'
        ? `"${period.name}" will be open again, so late corrections can be made. Criteria are locked while it is open.`
        : `Managers can start evaluations and employees can write self-assessments in "${period.name}". Criteria are locked while it is open.`,
    CLOSED: `Nobody can change evaluations or self-assessments in "${period.name}" any more. Approving and publishing are still possible.`,
  };
  return (
    <ConfirmDialog
      title={to === 'OPEN' ? (period.status === 'CLOSED' ? 'Reopen period' : 'Open period') : 'Close period'}
      message={messages[to]}
      confirmLabel={to === 'OPEN' ? (period.status === 'CLOSED' ? 'Reopen' : 'Open') : 'Close'}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/evaluation-periods/${period.id}/status`, { status: to }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function CriterionForm({ criterion, onClose, onSaved }) {
  const isNew = !criterion;
  const [v, setV] = useState({
    name: criterion?.name ?? '',
    description: criterion?.description ?? '',
    weight: criterion?.weight?.toString() ?? '',
    appliesTo: criterion?.appliesTo ?? 'EMPLOYEE',
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();

  function save(event) {
    event.preventDefault();
    // The weight is typed as text; the backend expects a number. An empty box is sent as-is so the backend can say what is missing.
    const weight = v.weight === '' ? undefined : Number(v.weight);
    const body = isNew ? { ...v, weight } : { name: v.name, description: v.description, weight };
    run(() => (isNew ? api.post('/evaluation-criteria', body) : api.patch(`/evaluation-criteria/${criterion.id}`, body)), () => {
      onSaved();
      onClose();
    });
  }

  return (
    <FormModal title={isNew ? 'New criterion' : `Edit ${criterion.name}`} formId="criterion-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Create' : 'Save'}>
      <form id="criterion-form" className="form-grid" onSubmit={save} noValidate>
        <ErrorAlert error={error} inForm />
        {isNew && (
          <Field label="For *" error={fieldError(error, 'appliesTo')}>
            <select value={v.appliesTo} onChange={set('appliesTo')}>
              <option value="EMPLOYEE">Employees</option>
              <option value="MANAGER">Managers</option>
            </select>
          </Field>
        )}
        <Field label="Name *" error={fieldError(error, 'name')}>
          <input value={v.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Description" error={fieldError(error, 'description')}>
          <textarea rows={3} value={v.description} onChange={set('description')} />
        </Field>
        <Field label="Weight (%) *" error={fieldError(error, 'weight')} hint="The active weights of each list must add up to 100%.">
          <input type="number" min="0" max="100" step="0.01" value={v.weight} onChange={set('weight')} />
        </Field>
      </form>
    </FormModal>
  );
}

function CriterionStatus({ criterion, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const activate = !criterion.isActive;
  return (
    <ConfirmDialog
      title={activate ? 'Activate criterion' : 'Deactivate criterion'}
      message={
        activate
          ? `"${criterion.name}" (${criterion.weight}%) will count again. Check that the total is still 100%.`
          : `"${criterion.name}" will no longer be used in new scores. Old evaluations keep it. Check that the total is still 100%.`
      }
      confirmLabel={activate ? 'Activate' : 'Deactivate'}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/evaluation-criteria/${criterion.id}/status`, { isActive: activate }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}
