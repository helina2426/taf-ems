// Holding: evaluation periods and the criteria (with their weights).
//
// Rules from the backend (shown on the page so nobody is surprised):
//   • A period goes UPCOMING → OPEN → CLOSED (and can be reopened for late corrections).
//   • A period can only be opened when each criteria list adds up to exactly 100%.
//   • Criteria cannot be changed while a period is open (scores already given would no longer match).
//
// Version 2 (Module 15): criteria are called "behaviours". Each one can describe what a score of
// 1–5 looks like, and one per list is the Safety behaviour. "Use the standard behaviours" loads
// the standard Taf lists (the old criteria are switched off, not deleted).

import { useState } from 'react';
import { api } from '../../api/client.js';
import { ConfirmDialog, FormModal } from '../../components/Modal.jsx';
import { Alert, Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate } from '../../utils/format.js';
import { LEVEL_NAMES, levelsFromForm, sortBehaviours } from '../../utils/behaviours.js';

const PERIOD_TONE = { UPCOMING: 'info', OPEN: 'good', CLOSED: 'neutral' };

export function EvaluationSetupPage() {
  const periods = useApi('/evaluation-periods');
  const criteria = useApi('/evaluation-criteria');
  const [dialog, setDialog] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const close = () => setDialog(null);
  const reloadAll = () => {
    periods.reload();
    criteria.reload();
  };

  const periodList = [...(periods.data?.items ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const openPeriod = periodList.find((p) => p.status === 'OPEN');

  return (
    <div className="page">
      <PageHeader title="Periods & behaviours" subtitle="When evaluations happen, and the behaviours people are scored on." />

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

      {/* ---------- Behaviours (the criteria) ---------- */}
      <div className="section-head behaviours-head">
        <h2 className="section-title">Behaviours</h2>
        <div className="button-row">
          <label className="checkbox">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            <span>Show inactive</span>
          </label>
          <button className="btn btn-ghost" onClick={() => setDialog({ type: 'standard' })} disabled={Boolean(openPeriod)}>
            Use the standard behaviours
          </button>
          <button className="btn btn-primary" onClick={() => setDialog({ type: 'criterion' })} disabled={Boolean(openPeriod)}>
            + New behaviour
          </button>
        </div>
      </div>
      <p className="muted small">
        Behaviours are <em>how</em> people work (the KPIs measure the results). For each one, describe what a score of 1 to 5 looks like, so every
        evaluator scores the same way.
      </p>
      {openPeriod && (
        <Alert type="info">
          Behaviours are locked while "{openPeriod.name}" is open. Close the period to change them.
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
              items={criteria.data.items.filter((c) => c.appliesTo === list && (showInactive || c.isActive))}
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
      {dialog?.type === 'standard' && <UseStandard onClose={close} onSaved={reloadAll} />}
    </div>
  );
}

function CriteriaList({ list, items, total, locked, onEdit, onToggle }) {
  const sorted = sortBehaviours(items);
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
      {sorted.length === 0 && <p className="muted">No behaviours yet.</p>}
      <ul className="criteria-list">
        {sorted.map((c) => (
          <li key={c.id} className={c.isActive ? '' : 'inactive'}>
            <div>
              <div className="strong">
                {c.name} {c.isSafety && <Badge tone="warn">Safety</Badge>} {!c.isActive && <Badge>Inactive</Badge>}
              </div>
              {c.description && <div className="muted small">{c.description}</div>}
              {c.levelDescriptions ? (
                <details className="levels">
                  <summary className="small">What 1–5 look like</summary>
                  <LevelList levels={c.levelDescriptions} />
                </details>
              ) : (
                c.isActive && <div className="small warn-text">Levels 1–5 not described yet</div>
              )}
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

// "1 · Not yet — Ignores safety rules…" for each level.
export function LevelList({ levels }) {
  return (
    <ol className="level-list">
      {levels.map((text, i) => (
        <li key={i}>
          <span className="level-name">
            {i + 1} · {LEVEL_NAMES[i]}
          </span>{' '}
          {text}
        </li>
      ))}
    </ol>
  );
}

// "Use the standard behaviours": shows the standard lists first, then loads them.
function UseStandard({ onClose, onSaved }) {
  const { data, error: loadError } = useApi('/evaluation-criteria/standard');
  const { run, busy, error } = useSubmit();
  return (
    <ConfirmDialog
      title="Use the standard behaviours"
      message="The behaviours that are active now will be switched off (not deleted: old evaluations keep their scores), and these lists will be added. You can change them afterwards."
      confirmLabel="Use these behaviours"
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.post('/evaluation-criteria/use-standard'), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={loadError || error} />
      {data && (
        <div className="two-columns standard-preview">
          {['EMPLOYEE', 'MANAGER'].map((list) => (
            <div key={list}>
              <h4>{list === 'EMPLOYEE' ? 'For employees' : 'For managers'}</h4>
              <ul className="plain-list small">
                {data.lists[list].map((b) => (
                  <li key={b.name}>
                    {b.name} — {b.weight}%{b.isSafety && ' (Safety)'}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </ConfirmDialog>
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
    isSafety: criterion?.isSafety ?? false,
  });
  const [levels, setLevels] = useState(criterion?.levelDescriptions ?? ['', '', '', '', '']);
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const setLevel = (i) => (e) => setLevels(levels.map((text, j) => (j === i ? e.target.value : text)));
  const { run, busy, error } = useSubmit();

  function save(event) {
    event.preventDefault();
    // The weight is typed as text; the backend expects a number. An empty box is sent as-is so the backend can say what is missing.
    const weight = v.weight === '' ? undefined : Number(v.weight);
    const levelDescriptions = levelsFromForm(levels);
    const common = { name: v.name, description: v.description, weight, isSafety: v.isSafety, levelDescriptions };
    const body = isNew ? { ...common, appliesTo: v.appliesTo } : common;
    run(() => (isNew ? api.post('/evaluation-criteria', body) : api.patch(`/evaluation-criteria/${criterion.id}`, body)), () => {
      onSaved();
      onClose();
    });
  }

  return (
    <FormModal title={isNew ? 'New behaviour' : `Edit ${criterion.name}`} formId="criterion-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Create' : 'Save'} wide>
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
        <label className="checkbox span-2">
          <input type="checkbox" checked={v.isSafety} onChange={(e) => setV({ ...v, isSafety: e.target.checked })} />
          <span>This is the Safety behaviour (only one per list; used by the safety rule)</span>
        </label>
        <fieldset className="span-2 levels-fieldset">
          <legend>What does each score look like?</legend>
          <p className="muted small">Fill in all 5, or leave all 5 empty. Short and concrete: what would you see this person do?</p>
          {levels.map((text, i) => (
            <Field key={i} label={`${i + 1} · ${LEVEL_NAMES[i]}`} error={fieldError(error, `levelDescriptions.${i}`)}>
              <input value={text} onChange={setLevel(i)} maxLength={300} />
            </Field>
          ))}
          {fieldError(error, 'levelDescriptions') && <span className="field-error">{fieldError(error, 'levelDescriptions')}</span>}
        </fieldset>
      </form>
    </FormModal>
  );
}

function CriterionStatus({ criterion, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const activate = !criterion.isActive;
  return (
    <ConfirmDialog
      title={activate ? 'Activate behaviour' : 'Deactivate behaviour'}
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
