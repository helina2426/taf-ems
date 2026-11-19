// Target changes during the year (version 2, Module 17).
//
//   • ChangeTargetDialog: on an ACTIVE plan, the Manager asks to change an employee KPI target
//     (the Head decides); the Head changes any target directly. A reason is always required.
//   • TargetChangeHistory: every change of a plan, under its progress.
//   • TargetChangesPage: the list for the Head (approve / reject) and for Managers (their requests).
// Months that are over keep their target; the preview shows which months change.

import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client.js';
import { FormModal } from '../../components/Modal.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDateTime, fullName } from '../../utils/format.js';
import { shortPeriodName } from '../../utils/planYears.js';
import { formatNumber } from '../../utils/plans.js';
import { CHANGE_STATUS, previewChange } from '../../utils/targetChanges.js';

export function ChangeTargetDialog({ plan, kpi, onClose, onDone }) {
  const direct = plan.can.changeDirectly;
  const [yearTarget, setYearTarget] = useState(String(kpi.yearTarget));
  const [reason, setReason] = useState('');
  const { run, busy, error } = useSubmit();
  const value = yearTarget === '' ? NaN : Number(yearTarget);
  const preview = value === kpi.yearTarget ? null : previewChange(kpi, value);

  return (
    <FormModal
      title={`${direct ? 'Change' : 'Ask to change'} the target — ${kpi.name}`}
      formId="change-target"
      busy={busy}
      onClose={onClose}
      submitLabel={direct ? 'Change the target' : 'Send to the Head'}
      wide
    >
      <form
        id="change-target"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post(`/kpis/${kpi.id}/change-requests`, { yearTarget: value, reason }), onDone);
        }}
      >
        <ErrorAlert error={error} inForm />
        <p className="muted small span-2">
          {direct
            ? 'You can change this target directly. It is saved in the history with your reason.'
            : 'The Head will approve or reject the change. Until then the current target stays.'}{' '}
          Months that are already over keep their target; the new year target is shared by the current and future months.
        </p>
        <Field label={`New year target (now ${formatNumber(kpi.yearTarget)} ${kpi.unit}) *`} error={fieldError(error, 'yearTarget')}>
          <input type="number" min="0" step="any" value={yearTarget} onChange={(e) => setYearTarget(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason *" error={fieldError(error, 'reason')} hint="What changed? For example: a new truck, a station closed for repairs.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {preview?.error && <p className="field-error span-2">{preview.error}</p>}
        {preview?.targets && (
          <div className="span-2">
            <div className="small strong">The months after the change</div>
            <div className="table-wrap">
              <table className="table months-table">
                <tbody>
                  {kpi.months.map((m, i) => (
                    <tr key={m.periodId} className={i < preview.firstChanged ? 'muted' : ''}>
                      <td>{shortPeriodName(m.name)}</td>
                      <td className="num">{formatNumber(m.target)}</td>
                      <td className="num strong">{i < preview.firstChanged ? 'kept' : `→ ${formatNumber(preview.targets[i])}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </FormModal>
  );
}

// One request: what changes, why, and what was decided. Approvers see Approve / Reject.
function ChangeCard({ request, showOwner, onChange }) {
  const status = CHANGE_STATUS[request.status];
  const [deciding, setDeciding] = useState(null); // 'approve' | 'reject'
  const owner = request.plan.level === 'INDIVIDUAL' ? fullName(request.plan.employee) : request.plan.level === 'COMPANY' ? `${request.plan.company.name} (company plan)` : 'Holding plan';
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>
            {request.kpi.name}: {formatNumber(request.oldYearTarget)} → {formatNumber(request.newYearTarget)} <span className="muted small">{request.kpi.unit}</span>
          </h3>
          {showOwner && (
            <div className="muted small">
              <Link to={`/plans/${request.plan.id}`}>{owner}</Link>
            </div>
          )}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="pre-wrap">{request.reason}</p>
      <div className="muted small">
        Asked by {request.requestedBy} · {formatDateTime(request.createdAt)} · {request.changedMonths.length} month(s) change
      </div>
      {request.decidedBy && request.status !== 'PENDING' && (
        <div className="muted small">
          {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {request.decidedBy} · {formatDateTime(request.decidedAt)}
          {request.decisionComment && ` — "${request.decisionComment}"`}
        </div>
      )}
      {request.can.decide && (
        <div className="button-row">
          <button className="btn btn-ghost btn-small" onClick={() => setDeciding('reject')}>
            Reject
          </button>
          <button className="btn btn-primary btn-small" onClick={() => setDeciding('approve')}>
            Approve
          </button>
        </div>
      )}
      {deciding && <DecideDialog request={request} approve={deciding === 'approve'} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); onChange(); }} />}
    </div>
  );
}

function DecideDialog({ request, approve, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={approve ? 'Approve the change' : 'Reject the change'} formId="decide-change" busy={busy} onClose={onClose} submitLabel={approve ? 'Approve' : 'Reject'}>
      <form
        id="decide-change"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post(`/change-requests/${request.id}/${approve ? 'approve' : 'reject'}`, comment.trim() ? { comment } : {}), onDone);
        }}
      >
        <ErrorAlert error={error} inForm />
        <p className="span-2">
          {request.kpi.name}: {formatNumber(request.oldYearTarget)} → <strong>{formatNumber(request.newYearTarget)}</strong>.{' '}
          {approve ? 'The current and future months get the new targets at once.' : 'The target stays as it is.'}
        </p>
        <Field label={approve ? 'Comment' : 'Reason *'} error={fieldError(error, 'comment')} hint={approve ? 'Optional.' : 'Tell the Manager why (at least 10 characters).'}>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
        </Field>
      </form>
    </FormModal>
  );
}

// Under an ACTIVE plan: every target change of this plan.
export function TargetChangeHistory({ planId, version }) {
  const { data, reload } = useApi('/change-requests', { planId, v: version });
  if (!data || data.items.length === 0) return null;
  return (
    <section className="progress-section">
      <h2 className="section-title">Target changes during the year</h2>
      {data.items.map((r) => (
        <ChangeCard key={r.id} request={r} onChange={reload} />
      ))}
    </section>
  );
}

// The "Target changes" page (Holding and Managers).
export function TargetChangesPage() {
  const [status, setStatus] = useState('PENDING');
  const { data, error, loading, reload } = useApi('/change-requests', status ? { status } : {});
  return (
    <div className="page">
      <PageHeader
        title="Target changes"
        subtitle="Changes of KPI targets during the year, with their reasons. Employee targets are asked for by the Manager and decided by the Head."
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="PENDING">Waiting for the Head</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
        }
      />
      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No target changes here.</EmptyState>}
      {data?.items.map((r) => (
        <ChangeCard key={r.id} request={r} showOwner onChange={reload} />
      ))}
    </div>
  );
}
