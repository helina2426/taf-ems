// One plan: its KPIs, their monthly targets, and the buttons to move it along.
// Used by every role. Which buttons appear comes from the server ("can"), so the screen and the
// server always agree — and the server checks again anyway.
//
//   Company plan:  Draft → Submit → (Head) Approve, or Return with a reason → fix → Submit again
//   Holding plan:  Draft → (Head) Activate
//   Employee plan: Draft → (Manager) Activate → (employee) Acknowledge

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { ConfirmDialog, FormModal, Modal } from '../../components/Modal.jsx';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate } from '../../utils/format.js';
import { shortPeriodName } from '../../utils/planYears.js';
import { ProgressSection } from './ProgressSection.jsx';
import {
  AGGREGATION,
  AGGREGATIONS,
  DIRECTION,
  DIRECTIONS,
  PERSPECTIVE,
  PERSPECTIVES,
  PLAN_STATUS,
  checkMonths,
  formatNumber,
  planTitle,
} from '../../utils/plans.js';

export function PlanDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/plans/${id}`);
  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <div className="page">
        <ErrorAlert error={error} />
        <Link to="/plans">← Plans</Link>
      </div>
    );
  }
  return <PlanView plan={data.plan} reload={reload} backTo="/plans" />;
}

// The plan itself. Also used by "My plan" (employees).
export function PlanView({ plan, reload, backTo }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  const can = plan.can;
  const status = PLAN_STATUS[plan.status];
  const share = plan.rules.resultsShare;
  const done = () => {
    close();
    reload();
  };

  // "Submit" and "Activate" wait until the plan is complete (the list above says what is missing).
  const actionButton = (type, label, primary = true) => (
    <button
      className={`btn ${primary ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => setDialog({ type })}
      disabled={['submit', 'activate'].includes(type) && !plan.readiness.ready}
      title={['submit', 'activate'].includes(type) && !plan.readiness.ready ? 'The plan is not complete yet.' : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="page">
      {backTo && (
        <Link to={backTo} className="small">
          ← Plans
        </Link>
      )}
      <PageHeader
        title={
          <>
            {planTitle(plan)} <Badge tone={status.tone}>{status.label}</Badge>
          </>
        }
        subtitle={`${plan.planYear.name} · ${formatDate(plan.planYear.startDate)} → ${formatDate(plan.planYear.endDate)}`}
        actions={
          <>
            {can.delete && actionButton('delete', 'Delete', false)}
            {can.edit && actionButton('kpi', '+ Add KPI', false)}
            {can.submit && actionButton('submit', 'Submit for approval')}
            {can.activate && actionButton('activate', plan.level === 'HOLDING' ? 'Activate' : 'Activate and share')}
            {can.return && actionButton('return', 'Return to fix', false)}
            {can.approve && actionButton('approve', 'Approve')}
            {can.acknowledge && actionButton('acknowledge', 'Acknowledge')}
          </>
        }
      />

      {plan.status === 'RETURNED' && plan.returnComment && (
        <Alert type="error">
          <strong>Returned to fix:</strong> {plan.returnComment}
        </Alert>
      )}
      {plan.status === 'SUBMITTED' && <Alert type="info">This plan is waiting for the Holding's approval. It cannot be changed until it is approved or returned.</Alert>}
      {can.edit && !plan.readiness.ready && (
        <Alert type="info">
          Not complete yet:
          <ul className="alert-details">
            {plan.readiness.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}
      {can.edit && plan.readiness.ready && <Alert type="success">The plan is complete. {plan.level === 'COMPANY' ? 'You can submit it for approval.' : 'You can activate it.'}</Alert>}
      {can.edit && <p className="muted small">Plans should be signed by {formatDate(plan.signDeadline)}.</p>}
      {plan.level === 'INDIVIDUAL' && plan.acknowledgedAt && (
        <Alert type="success">
          Acknowledged by the employee on {formatDate(plan.acknowledgedAt)}.{plan.acknowledgeComment && ` "${plan.acknowledgeComment}"`}
        </Alert>
      )}

      {plan.level !== 'HOLDING' && (
        <div className="stat-grid">
          <Stat label="KPIs" value={plan.kpiCount} hint={`between ${plan.rules.minKpis} and ${plan.rules.maxKpis}`} ok={plan.kpiCount >= plan.rules.minKpis && plan.kpiCount <= plan.rules.maxKpis} />
          <Stat label="Points for results" value={`${plan.weightTotal} / ${share}`} hint={`each KPI ${plan.rules.minKpiWeight}–${plan.rules.maxKpiWeight} points; behaviours get the other ${100 - share}`} ok={plan.weightTotal === share} />
          {plan.level === 'COMPANY' && (
            <Stat
              label="Perspectives covered"
              value={`${Object.values(plan.perspectives).filter(Boolean).length} / 4`}
              hint={PERSPECTIVES.filter((p) => !plan.perspectives[p.value]).map((p) => p.label).join(', ') || 'all four'}
              ok={Object.values(plan.perspectives).every(Boolean)}
            />
          )}
        </div>
      )}

      <KpiTable plan={plan} onEdit={(kpi) => setDialog({ type: 'kpi', kpi })} onMonths={(kpi) => setDialog({ type: 'months', kpi })} onDelete={(kpi) => setDialog({ type: 'deleteKpi', kpi })} />

      {/* Module 13: the real numbers, month by month, once the plan is active. */}
      {plan.status === 'ACTIVE' && <ProgressSection planId={plan.id} />}

      {dialog?.type === 'kpi' && <KpiForm plan={plan} kpi={dialog.kpi} onClose={close} onSaved={done} />}
      {dialog?.type === 'months' && <MonthsForm plan={plan} kpi={dialog.kpi} onClose={close} onSaved={done} />}
      {dialog?.type === 'deleteKpi' && (
        <Confirm title={`Remove "${dialog.kpi.name}"?`} message="The KPI and its 12 monthly targets will be removed." label="Remove" danger action={() => api.delete(`/kpis/${dialog.kpi.id}`)} onClose={close} onDone={done} />
      )}
      {dialog?.type === 'submit' && (
        <Confirm title="Submit for approval?" message="The Holding will review the plan. You cannot change it while it waits." label="Submit" action={() => api.post(`/plans/${plan.id}/submit`)} onClose={close} onDone={done} />
      )}
      {dialog?.type === 'activate' && (
        <Confirm
          title="Activate this plan?"
          message={plan.level === 'HOLDING' ? 'Company plans can then be linked to it and submitted. It cannot be changed afterwards.' : 'The employee will see the plan and can acknowledge it. It cannot be changed afterwards.'}
          label="Activate"
          action={() => api.post(`/plans/${plan.id}/activate`)}
          onClose={close}
          onDone={done}
        />
      )}
      {dialog?.type === 'approve' && (
        <Confirm title="Approve this company plan?" message="The plan becomes active. The Manager can then activate the employee plans." label="Approve" action={() => api.post(`/plans/${plan.id}/approve`)} onClose={close} onDone={done} />
      )}
      {dialog?.type === 'return' && <CommentDialog title="Return to fix" label="Return" required hint="Tell the Manager what to change (at least 10 characters)." action={(comment) => api.post(`/plans/${plan.id}/return`, { comment })} onClose={close} onDone={done} />}
      {dialog?.type === 'acknowledge' && <CommentDialog title="Acknowledge your plan" label="Acknowledge" hint='Optional comment. Acknowledging means "I have read my plan".' action={(comment) => api.post(`/plans/${plan.id}/acknowledge`, { comment })} onClose={close} onDone={done} />}
      {dialog?.type === 'delete' && (
        <Confirm
          title="Delete this plan?"
          message="The plan, its KPIs and their monthly targets will be deleted. This cannot be undone."
          label="Delete"
          danger
          action={() => api.delete(`/plans/${plan.id}`)}
          onClose={close}
          onDone={() => navigate('/plans')}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint, ok }) {
  return (
    <div className={`stat-card tone-${ok ? 'good' : 'warn'}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

function KpiTable({ plan, onEdit, onMonths, onDelete }) {
  if (plan.kpis.length === 0) return <div className="empty-state">No KPIs yet.{plan.can.edit && ' Click "+ Add KPI" to add the first one.'}</div>;
  return (
    <div className="table-wrap">
      <table className="table kpi-table">
        <thead>
          <tr>
            <th>Perspective</th>
            <th>KPI</th>
            <th className="num">Year target</th>
            {plan.level !== 'HOLDING' && <th className="num">Weight</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {plan.kpis.map((kpi) => (
            <tr key={kpi.id}>
              <td className="small">{PERSPECTIVE[kpi.perspective].label}</td>
              <td>
                <div className="strong">{kpi.name}</div>
                {kpi.description && <div className="muted small">{kpi.description}</div>}
                <div className="muted small">
                  {DIRECTION[kpi.direction].short} · {AGGREGATION[kpi.aggregation].label.toLowerCase()}
                  {kpi.parentKpi && <> · helps reach <em>{kpi.parentKpi.name}</em></>}
                </div>
                {kpi.linkedKpis && kpi.linkedKpis.length > 0 && (
                  <div className="muted small">
                    Linked: {kpi.linkedKpis.map((l) => `${l.owner} (${formatNumber(l.yearTarget)})`).join(', ')}
                  </div>
                )}
                {kpi.warning && <div className="field-error">⚠ {kpi.warning}</div>}
              </td>
              <td className="num">
                <span className="strong">{formatNumber(kpi.yearTarget)}</span> <span className="muted small">{kpi.unit}</span>
                {kpi.baseline !== null && <div className="muted small">last year {formatNumber(kpi.baseline)}</div>}
              </td>
              {plan.level !== 'HOLDING' && <td className="num strong">{kpi.weight ?? '—'}</td>}
              <td className="row-actions">
                <button className="btn btn-ghost btn-small" onClick={() => onMonths(kpi)}>
                  Months
                </button>
                {plan.can.edit && (
                  <>
                    <button className="btn btn-ghost btn-small" onClick={() => onEdit(kpi)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => onDelete(kpi)}>
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The KPIs of the level above, to link a new KPI to (Holding KPIs for a company plan,
// company KPIs for an employee plan).
function useParentKpis(plan) {
  const parentLevel = plan.level === 'COMPANY' ? 'HOLDING' : plan.level === 'INDIVIDUAL' ? 'COMPANY' : null;
  const list = useApi(parentLevel ? '/plans' : null, { planYearId: plan.planYear.id, level: parentLevel, ...(parentLevel === 'COMPANY' && { companyId: plan.company?.id }) });
  const parentId = list.data?.items[0]?.id;
  const parent = useApi(parentId ? `/plans/${parentId}` : null);
  return { parentLevel, kpis: parent.data?.plan.kpis ?? [], loading: list.loading || parent.loading };
}

function KpiForm({ plan, kpi, onClose, onSaved }) {
  const isNew = !kpi;
  const parents = useParentKpis(plan);
  const [v, setV] = useState({
    parentKpiId: kpi?.parentKpi?.id ?? '',
    perspective: kpi?.perspective ?? 'FINANCIAL',
    name: kpi?.name ?? '',
    description: kpi?.description ?? '',
    unit: kpi?.unit ?? '',
    direction: kpi?.direction ?? 'HIGHER_IS_BETTER',
    aggregation: kpi?.aggregation ?? 'SUM',
    baseline: kpi?.baseline ?? '',
    yearTarget: kpi?.yearTarget ?? '',
    weight: kpi?.weight ?? '',
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();

  // Choosing the KPI above fills in its name, unit and type as a starting point.
  const chooseParent = (e) => {
    const parent = parents.kpis.find((k) => k.id === e.target.value);
    setV({
      ...v,
      parentKpiId: e.target.value,
      ...(parent && isNew && !v.name && { name: parent.name, unit: parent.unit, perspective: parent.perspective, direction: parent.direction, aggregation: parent.aggregation }),
    });
  };

  const zero = v.direction === 'ZERO';
  const body = () => {
    const values = {
      perspective: v.perspective,
      name: v.name,
      description: v.description,
      unit: v.unit,
      direction: v.direction,
      aggregation: zero ? 'SUM' : v.aggregation,
      baseline: v.baseline === '' ? null : Number(v.baseline),
      yearTarget: zero ? 0 : v.yearTarget === '' ? undefined : Number(v.yearTarget),
    };
    if (plan.level !== 'HOLDING') {
      values.weight = v.weight === '' ? null : Number(v.weight);
      values.parentKpiId = v.parentKpiId || null;
    }
    return values;
  };

  return (
    <FormModal title={isNew ? 'Add a KPI' : `Edit "${kpi.name}"`} formId="kpi-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Add' : 'Save'} wide>
      <form
        id="kpi-form"
        className="form-grid form-grid-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (isNew ? api.post('/kpis', { planId: plan.id, ...body() }) : api.patch(`/kpis/${kpi.id}`, body())), onSaved);
        }}
      >
        <ErrorAlert error={error} inForm />
        {parents.parentLevel && (
          <div className="span-2">
            <Field
              label={`Helps reach this ${parents.parentLevel === 'HOLDING' ? 'Holding' : 'company'} KPI *`}
              error={fieldError(error, 'parentKpiId')}
              hint={parents.kpis.length === 0 && !parents.loading ? `The ${parents.parentLevel === 'HOLDING' ? 'Holding' : 'company'} plan has no KPIs yet.` : 'This keeps the hierarchy: every KPI serves a KPI of the level above.'}
            >
              <select value={v.parentKpiId} onChange={chooseParent}>
                <option value="">— Choose —</option>
                {parents.kpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({formatNumber(k.yearTarget)} {k.unit})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Name *" error={fieldError(error, 'name')}>
          <input value={v.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Perspective *" error={fieldError(error, 'perspective')} hint={PERSPECTIVE[v.perspective].help}>
          <select value={v.perspective} onChange={set('perspective')}>
            {PERSPECTIVES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="span-2">
          <Field label="Description" error={fieldError(error, 'description')}>
            <input value={v.description} onChange={set('description')} placeholder="Optional: how it is measured" />
          </Field>
        </div>
        <Field label="Which result is good? *" error={fieldError(error, 'direction')} hint={DIRECTION[v.direction].help}>
          <select value={v.direction} onChange={set('direction')}>
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How do the months add up? *" error={fieldError(error, 'aggregation')} hint={zero ? 'A "zero is best" KPI adds the months up.' : AGGREGATION[v.aggregation].help}>
          <select value={zero ? 'SUM' : v.aggregation} onChange={set('aggregation')} disabled={zero}>
            {AGGREGATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit *" error={fieldError(error, 'unit')} hint='For example "deliveries", "%", "litres", "ETB".'>
          <input value={v.unit} onChange={set('unit')} />
        </Field>
        <Field label="Year target *" error={fieldError(error, 'yearTarget')} hint={zero ? 'Always 0.' : 'Split into 12 monthly targets automatically.'}>
          <input type="number" min="0" step="any" value={zero ? 0 : v.yearTarget} onChange={set('yearTarget')} disabled={zero} />
        </Field>
        <Field label="Last year (baseline)" error={fieldError(error, 'baseline')} hint="Optional, for comparison.">
          <input type="number" min="0" step="any" value={v.baseline} onChange={set('baseline')} />
        </Field>
        {plan.level !== 'HOLDING' && (
          <Field label="Weight (points) *" error={fieldError(error, 'weight')} hint={`Between ${plan.rules.minKpiWeight} and ${plan.rules.maxKpiWeight}. All KPIs together: ${plan.rules.resultsShare}.`}>
            <input type="number" min="1" step="1" value={v.weight} onChange={set('weight')} />
          </Field>
        )}
        {!isNew && <p className="muted small span-2">Changing the year target, "which result is good" or "how the months add up" splits the 12 months again.</p>}
      </form>
    </FormModal>
  );
}

function MonthsForm({ plan, kpi, onClose, onSaved }) {
  const editable = plan.can.edit && kpi.direction !== 'ZERO';
  const [targets, setTargets] = useState(kpi.months.map((m) => String(m.target)));
  const { run, busy, error } = useSubmit();
  const check = checkMonths(targets, kpi.yearTarget, kpi.aggregation);

  const table = (
    <>
      <p className="muted small">
        Year target: <strong>{formatNumber(kpi.yearTarget)} {kpi.unit}</strong> · {AGGREGATION[kpi.aggregation].help}
      </p>
      <table className="table months-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Dates</th>
            <th className="num">Target</th>
          </tr>
        </thead>
        <tbody>
          {kpi.months.map((m, i) => (
            <tr key={m.periodId}>
              <td>{shortPeriodName(m.name)}</td>
              <td className="small muted">
                {formatDate(m.startDate)} – {formatDate(m.endDate)}
              </td>
              <td className="num">
                {editable ? (
                  <input type="number" min="0" step="any" value={targets[i]} onChange={(e) => setTargets(targets.map((t, j) => (j === i ? e.target.value : t)))} aria-label={`Target for ${shortPeriodName(m.name)}`} />
                ) : (
                  formatNumber(m.target)
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="strong">
              {kpi.aggregation === 'SUM' ? 'Total' : kpi.aggregation === 'AVERAGE' ? 'Average' : 'Last month'}
            </td>
            <td className="num strong">{formatNumber(kpi.aggregation === 'SUM' ? check.total : kpi.aggregation === 'AVERAGE' ? check.average : Number(targets[11]))}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );

  if (!editable) {
    return (
      <Modal title={`Monthly targets · ${kpi.name}`} onClose={onClose}>
        {table}
      </Modal>
    );
  }
  return (
    <FormModal title={`Monthly targets · ${kpi.name}`} formId="months-form" busy={busy} onClose={onClose}>
      <form
        id="months-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.put(`/kpis/${kpi.id}/months`, { targets: targets.map(Number) }), onSaved);
        }}
      >
        <ErrorAlert error={error} />
        {check.message ? <Alert type="error">{check.message}</Alert> : <Alert type="success">The months fit the year target.</Alert>}
        {table}
      </form>
    </FormModal>
  );
}

function Confirm({ title, message, label, danger, action, onClose, onDone }) {
  const { run, busy, error } = useSubmit();
  return (
    <ConfirmDialog title={title} message={message} confirmLabel={label} danger={danger} busy={busy} onClose={onClose} onConfirm={() => run(action, onDone)}>
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}

function CommentDialog({ title, label, hint, required, action, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={title} formId="comment-form" busy={busy} onClose={onClose} submitLabel={label}>
      <form
        id="comment-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => action(comment.trim() || (required ? comment : undefined)), onDone);
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label={required ? 'Reason *' : 'Comment'} error={fieldError(error, 'comment')} hint={hint}>
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
        </Field>
      </form>
    </FormModal>
  );
}
