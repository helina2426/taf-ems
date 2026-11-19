// Appeals (version 2, Module 18).
//
//   • AppealSection (on an evaluation): the person evaluated can appeal a "Partially meets" or
//     "Does not meet" rating within 14 days of acknowledging it; once appealed, everybody who
//     may read the evaluation sees the appeal and the decision.
//   • An independent Holding approver (who did not write or approve the evaluation) decides:
//     the rating is kept, or changed to a new score. The decision is final.
//   • AppealsPage: the list for the Holding (and Managers, for their employees).

import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client.js';
import { Alert, Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { APPEAL_LABEL, RATING_LABEL, RATING_TONE, newRatingPreview } from '../../utils/evaluations.js';
import { fieldError, formatDate, formatDateTime, fullName } from '../../utils/format.js';

export function AppealSection({ ev, onSaved }) {
  if (ev.appeal) return <AppealView appeal={ev.appeal} onSaved={onSaved} />;
  if (ev.canAppeal) return <AppealForm ev={ev} onSaved={onSaved} />;
  return null;
}

function AppealForm({ ev, onSaved }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { run, busy, error } = useSubmit();
  return (
    <div className="panel">
      <h3>Appeal</h3>
      <p className="muted">
        If you think the rating is not fair, you can appeal until <strong>{formatDate(ev.appealDeadline)}</strong>. A Holding approver who did not write or
        approve this evaluation will look at it again. You can appeal only once, and the decision is final.
      </p>
      {!open ? (
        <button className="btn btn-ghost" onClick={() => setOpen(true)}>
          Appeal this rating
        </button>
      ) : (
        <>
          <ErrorAlert error={error} inForm />
          <Field label="Why do you appeal? *" error={fieldError(error, 'reason')} hint="Be concrete: which score, and what facts show it should be different.">
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <div className="button-row">
            <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post(`/evaluations/${ev.id}/appeal`, { reason }), onSaved)}>
              Send the appeal
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AppealView({ appeal, onSaved }) {
  const status = APPEAL_LABEL[appeal.outcome ?? appeal.status];
  return (
    <div className="panel panel-highlight">
      <div className="panel-head">
        <h3>Appeal</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="pre-wrap">{appeal.reason}</p>
      <div className="muted small">
        Sent {formatDateTime(appeal.createdAt)} · rating at that time: {RATING_LABEL[appeal.originalRating]} ({appeal.originalScore})
      </div>
      {appeal.status === 'DECIDED' && (
        <div className="appeal-decision">
          <div className="strong">
            {appeal.outcome === 'RATING_CHANGED' ? (
              <>
                Rating changed to <Badge tone={RATING_TONE[appeal.newRating]}>{RATING_LABEL[appeal.newRating]}</Badge> ({appeal.newScore})
              </>
            ) : (
              'Rating kept'
            )}
          </div>
          <p className="pre-wrap">{appeal.decisionComment}</p>
          <div className="muted small">
            Decided by {appeal.decidedBy} · {formatDateTime(appeal.decidedAt)} · final
          </div>
        </div>
      )}
      {appeal.status === 'SUBMITTED' && appeal.whyCannotDecide && <p className="muted small">{appeal.whyCannotDecide}</p>}
      {appeal.can.decide && <DecideForm appeal={appeal} onSaved={onSaved} />}
    </div>
  );
}

function DecideForm({ appeal, onSaved }) {
  const [outcome, setOutcome] = useState('RATING_KEPT');
  const [newScore, setNewScore] = useState('');
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  const preview = newRatingPreview(newScore, appeal.originalRating);
  const submit = () =>
    run(() => api.post(`/appeals/${appeal.id}/decide`, { outcome, comment, ...(outcome === 'RATING_CHANGED' && newScore !== '' && { newScore: Number(newScore) }) }), onSaved);

  return (
    <div className="appeal-decide">
      <h4>Your decision (final)</h4>
      <ErrorAlert error={error} inForm />
      <div className="radio-row">
        <label className="checkbox">
          <input type="radio" name="outcome" checked={outcome === 'RATING_KEPT'} onChange={() => setOutcome('RATING_KEPT')} />
          <span>Keep the rating ({RATING_LABEL[appeal.originalRating]})</span>
        </label>
        <label className="checkbox">
          <input type="radio" name="outcome" checked={outcome === 'RATING_CHANGED'} onChange={() => setOutcome('RATING_CHANGED')} />
          <span>Change it</span>
        </label>
      </div>
      {outcome === 'RATING_CHANGED' && (
        <Field label="New score (0–100) *" error={fieldError(error, 'newScore')} hint={preview ? `→ ${RATING_LABEL[preview]}` : 'The new score must give a different rating.'}>
          <input type="number" min="0" max="100" step="0.1" value={newScore} onChange={(e) => setNewScore(e.target.value)} />
        </Field>
      )}
      <Field label="Explanation *" error={fieldError(error, 'comment')} hint="The person will read it (at least 20 characters).">
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          Decide
        </button>
      </div>
    </div>
  );
}

// The "Appeals" page.
export function AppealsPage() {
  const [status, setStatus] = useState('SUBMITTED');
  const { data, error, loading } = useApi('/appeals', status ? { status } : {});
  return (
    <div className="page">
      <PageHeader
        title="Appeals"
        subtitle="Appeals against low ratings. Each one is decided by a Holding approver who did not write or approve the evaluation."
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="SUBMITTED">Waiting for a decision</option>
            <option value="DECIDED">Decided</option>
            <option value="">All</option>
          </select>
        }
      />
      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No appeals here.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="card-list">
          {data.items.map((a) => {
            const badge = APPEAL_LABEL[a.outcome ?? a.status];
            return (
              <Link key={a.id} to={`/evaluations/${a.evaluation.id}`} className="card-link">
                <div>
                  <div className="strong">
                    {fullName(a.evaluation.employee)} {a.evaluation.type === 'MANAGER' && <Badge tone="brand">Manager</Badge>}
                  </div>
                  <div className="muted small">
                    {a.evaluation.company.name} · {a.evaluation.period} · sent {formatDate(a.createdAt)}
                  </div>
                  <div className="small">
                    {RATING_LABEL[a.originalRating]} ({a.originalScore}){a.outcome === 'RATING_CHANGED' && ` → ${RATING_LABEL[a.newRating]} (${a.newScore})`}
                  </div>
                </div>
                <div className="card-link-right">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {a.can.decide && <Badge tone="warn">You can decide</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {data && status === 'SUBMITTED' && data.items.length > 0 && !data.items.some((a) => a.can.decide) && (
        <Alert type="info">You cannot decide these appeals (you wrote or approved the evaluations). Another Holding approver must decide them.</Alert>
      )}
    </div>
  );
}
