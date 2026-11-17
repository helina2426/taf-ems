// Holding: one plan year — its rules, its 19 periods, and the buttons to move it along.
//
//   PLANNING ──Activate──▶ ACTIVE ──Close year──▶ CLOSED
//       ▲                    │  ▲                   │
//       └──Back to planning──┘  └──── Reopen ───────┘  (primary Holding user only)
//
// While ACTIVE, each month can be opened and closed. A closed month is frozen
// (from Module 13: its actual numbers can no longer change).

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { ConfirmDialog, FormModal } from '../../components/Modal.jsx';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate, formatDateBoth } from '../../utils/format.js';
import {
  CALENDAR_LABEL,
  PERIOD_STATUS,
  PLAN_YEAR_STATUS,
  RULES,
  changedRules,
  periodRows,
  rulesFromForm,
  shortPeriodName,
} from '../../utils/planYears.js';

// What each status button does, with the warning shown before it happens.
const YEAR_ACTIONS = {
  ACTIVE_FROM_PLANNING: {
    label: 'Activate',
    title: 'Activate this plan year?',
    message: 'The year, and every half, quarter and month that has already started, will be opened. The rules can no longer be changed.',
  },
  PLANNING: {
    label: 'Back to planning',
    title: 'Go back to planning?',
    message: 'Every period goes back to "Upcoming", and the rules can be changed again.',
  },
  CLOSED: {
    label: 'Close year',
    title: 'Close this plan year?',
    message: 'Every period will be closed and nothing in this year can change any more. Only the primary Holding user can reopen it.',
    danger: true,
  },
  ACTIVE_FROM_CLOSED: {
    label: 'Reopen',
    title: 'Reopen this plan year?',
    message: 'The year becomes active again for corrections. Its months stay closed until you reopen them one by one.',
  },
};

const MONTH_ACTIONS = { UPCOMING: ['OPEN', 'Open'], OPEN: ['CLOSED', 'Close'], CLOSED: ['OPEN', 'Reopen'] };

export function PlanYearDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/plan-years/${id}`);
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);

  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <div className="page">
        <ErrorAlert error={error} />
        <Link to="/plan-years">← Back to plan years</Link>
      </div>
    );
  }

  const year = data.planYear;
  const status = PLAN_YEAR_STATUS[year.status];
  const rows = periodRows(year.periods);
  const button = (key, to) => (
    <button className={`btn ${YEAR_ACTIONS[key].danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => setDialog({ type: 'year', key, to })}>
      {YEAR_ACTIONS[key].label}
    </button>
  );

  return (
    <div className="page">
      <Link to="/plan-years" className="small">
        ← Plan years
      </Link>
      <PageHeader
        title={
          <>
            {year.name} <Badge tone={status.tone}>{status.label}</Badge>
          </>
        }
        subtitle={`${CALENDAR_LABEL[year.calendar]} · ${formatDateBoth(year.startDate)} → ${formatDateBoth(year.endDate)}`}
        actions={
          <>
            {year.status === 'PLANNING' && (
              <>
                <button className="btn btn-ghost" onClick={() => setDialog({ type: 'rules' })}>
                  Change the rules
                </button>
                <button className="btn btn-ghost" onClick={() => setDialog({ type: 'delete' })}>
                  Delete
                </button>
                {button('ACTIVE_FROM_PLANNING', 'ACTIVE')}
              </>
            )}
            {year.status === 'ACTIVE' && (
              <>
                <button className="btn btn-ghost" onClick={() => setDialog({ type: 'year', key: 'PLANNING', to: 'PLANNING' })}>
                  Back to planning
                </button>
                {button('CLOSED', 'CLOSED')}
              </>
            )}
            {year.status === 'CLOSED' && user.isPrimaryHoldingUser && button('ACTIVE_FROM_CLOSED', 'ACTIVE')}
          </>
        }
      />

      {year.status === 'PLANNING' && (
        <Alert type="info">This year is being prepared. Check the rules below, then activate it to start using its months.</Alert>
      )}

      <h2 className="section-title">Rules of this year</h2>
      <dl className="rules-list">
        {RULES.map((rule) => (
          <div key={rule.key} title={rule.help}>
            <dt>{rule.label}</dt>
            <dd>
              {rule.key === 'safetyCapEnabled' ? (year.rules[rule.key] ? 'On' : 'Off') : `${year.rules[rule.key]} ${rule.unit}`}
            </dd>
            <div className="small muted">{rule.help}</div>
          </div>
        ))}
      </dl>

      <h2 className="section-title">Halves, quarters and months</h2>
      <div className="table-wrap">
        <table className="table tree-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const action = MONTH_ACTIONS[p.status];
              return (
                <tr key={p.id} className={p.level === 0 ? 'row-half' : p.level === 1 ? 'row-quarter' : ''}>
                  <td className={`indent-${p.level}`}>{shortPeriodName(p.name)}</td>
                  <td className="small">{formatDate(p.startDate)}</td>
                  <td className="small">{formatDate(p.endDate)}</td>
                  <td>
                    <Badge tone={PERIOD_STATUS[p.status].tone}>{PERIOD_STATUS[p.status].label}</Badge>
                  </td>
                  <td className="row-actions">
                    {p.type === 'MONTH' && year.status === 'ACTIVE' && (
                      <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'month', month: p, to: action[0], label: action[1] })}>
                        {action[1]}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog?.type === 'rules' && <RulesForm year={year} onClose={close} onSaved={reload} />}
      {dialog?.type === 'year' && <YearStatus year={year} action={YEAR_ACTIONS[dialog.key]} to={dialog.to} onClose={close} onSaved={reload} />}
      {dialog?.type === 'month' && <MonthStatus year={year} {...dialog} onClose={close} onSaved={reload} />}
      {dialog?.type === 'delete' && <DeleteYear year={year} onClose={close} onDeleted={() => navigate('/plan-years')} />}
    </div>
  );
}

function YearStatus({ year, action, to, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  return (
    <ConfirmDialog
      title={action.title}
      message={action.message}
      confirmLabel={action.label}
      danger={action.danger}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/plan-years/${year.id}/status`, { status: to }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function MonthStatus({ year, month, to, label, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const messages = {
    OPEN: 'Actual numbers for this month can be entered and changed.',
    CLOSED: 'This month is frozen: its actual numbers can no longer change. You can reopen it later for a correction.',
  };
  return (
    <ConfirmDialog
      title={`${label} ${shortPeriodName(month.name)}?`}
      message={messages[to]}
      confirmLabel={label}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.patch(`/plan-years/${year.id}/months/${month.id}/status`, { status: to }), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function DeleteYear({ year, onClose, onDeleted }) {
  const { run, busy, error } = useSubmit();
  return (
    <ConfirmDialog
      title={`Delete ${year.name}?`}
      message="The plan year and its 19 periods will be deleted. This is only possible while the year is still being planned."
      confirmLabel="Delete"
      danger
      busy={busy}
      onClose={onClose}
      onConfirm={() => run(() => api.delete(`/plan-years/${year.id}`), onDeleted)}
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function RulesForm({ year, onClose, onSaved }) {
  const [v, setV] = useState(year.rules);
  const { run, busy, error, setError } = useSubmit();
  const set = (key) => (e) => setV({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <FormModal title={`Rules of ${year.name}`} formId="rules-form" busy={busy} onClose={onClose} wide>
      <form
        id="rules-form"
        className="form-grid form-grid-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const changes = changedRules(year.rules, rulesFromForm(v));
          if (Object.keys(changes).length === 0) {
            setError({ message: 'Nothing was changed.' });
            return;
          }
          run(() => api.patch(`/plan-years/${year.id}`, changes), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        {RULES.map((rule) =>
          rule.key === 'safetyCapEnabled' ? (
            <label key={rule.key} className="checkbox">
              <input type="checkbox" checked={Boolean(v[rule.key])} onChange={set(rule.key)} /> {rule.label} — {rule.help}
            </label>
          ) : (
            <Field key={rule.key} label={`${rule.label}${rule.unit ? ` (${rule.unit})` : ''}`} error={fieldError(error, rule.key)} hint={rule.help}>
              <input type="number" value={v[rule.key]} onChange={set(rule.key)} />
            </Field>
          ),
        )}
      </form>
    </FormModal>
  );
}
