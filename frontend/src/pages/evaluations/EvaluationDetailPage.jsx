// One evaluation, with everything that can be done to it — depending on who is looking:
//   • the evaluator (Manager, or an approver for a Manager evaluation): scores, feedback, submit
//   • an approver: approve, return with a reason, publish
//   • the person evaluated (after publication): read it and acknowledge it
// The backend checks every action again; the page only shows the buttons that make sense.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { STATUS_LABEL, STATUS_TONE, canWrite, isApprover, previewScore } from '../../utils/evaluations.js';
import { formatDate, formatDateTime, fullName, percent } from '../../utils/format.js';

export function EvaluationDetailPage() {
  const { id } = useParams(); // the :id part of the address
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(`/evaluations/${id}`);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;

  const ev = data.evaluation;
  const writable = canWrite(user, ev);
  const isPerson = ev.employee.id === user.employeeId;
  const backTo = isPerson ? '/my-evaluations' : '/evaluations';

  return (
    <div className="page">
      <Link to={backTo} className="back-link">
        ← Back
      </Link>
      <PageHeader
        title={fullName(ev.employee)}
        subtitle={`${ev.type === 'MANAGER' ? 'Manager evaluation' : 'Employee evaluation'} · ${ev.company.name} · ${ev.period.name}`}
        actions={<Badge tone={STATUS_TONE[ev.status]}>{STATUS_LABEL[ev.status]}</Badge>}
      />

      {ev.status === 'RETURNED' && !isPerson && ev.reviews?.length > 0 && (
        <Alert type="error">
          <strong>Returned to fix:</strong> {ev.reviews.at(-1).comment}
        </Alert>
      )}
      {ev.period.status !== 'OPEN' && ['DRAFT', 'RETURNED'].includes(ev.status) && (
        <Alert type="info">The period is {ev.period.status.toLowerCase()}, so this evaluation cannot be changed now.</Alert>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          {writable ? <ScoreEditor ev={ev} onSaved={reload} /> : <ScoreTable ev={ev} />}
          {writable ? <FeedbackEditor ev={ev} onSaved={reload} /> : <FeedbackView ev={ev} />}
          {writable && <SubmitBox ev={ev} onSaved={reload} />}
          {isPerson && ev.status === 'PUBLISHED' && <Acknowledge ev={ev} onSaved={reload} />}
        </div>

        <aside className="detail-side">
          <div className="panel score-panel">
            <div className="stat-label">Overall score</div>
            <div className="score-big">{percent(ev.overallScore)}</div>
            {ev.overallScore === null && <div className="muted small">Shown when every criterion has a score.</div>}
          </div>

          {isApprover(user) && ['SUBMITTED', 'APPROVED'].includes(ev.status) && <ReviewBox ev={ev} onSaved={reload} />}

          {!isPerson && (
            <div className="panel">
              <h3>Self-assessment</h3>
              {ev.selfAssessment ? (
                <>
                  <p className="pre-wrap">{ev.selfAssessment.comments}</p>
                  <div className="muted small">Submitted {formatDate(ev.selfAssessment.submittedAt)}</div>
                </>
              ) : (
                <p className="muted">Not submitted for this period.</p>
              )}
            </div>
          )}

          <div className="panel">
            <h3>Details</h3>
            <dl className="facts">
              <dt>Evaluator</dt>
              <dd>{ev.evaluator ?? '—'}</dd>
              <dt>Submitted</dt>
              <dd>{formatDateTime(ev.submittedAt)}</dd>
              <dt>Published</dt>
              <dd>{ev.publishedAt ? `${formatDateTime(ev.publishedAt)} by ${ev.publishedBy}` : '—'}</dd>
              <dt>Acknowledged</dt>
              <dd>{formatDateTime(ev.acknowledgedAt)}</dd>
            </dl>
            {ev.employeeComment && (
              <>
                <h4>Comment from {ev.employee.firstName}</h4>
                <p className="pre-wrap">{ev.employeeComment}</p>
              </>
            )}
          </div>

          {ev.reviews?.length > 0 && (
            <div className="panel">
              <h3>Review history</h3>
              <ul className="timeline">
                {ev.reviews.map((r, i) => (
                  <li key={i}>
                    <Badge tone={r.decision === 'APPROVED' ? 'good' : 'warn'}>{r.decision === 'APPROVED' ? 'Approved' : 'Returned'}</Badge>
                    <div className="small muted">
                      {r.reviewer} · {formatDateTime(r.decidedAt)}
                    </div>
                    {r.comment && <div className="pre-wrap">{r.comment}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Read-only list of scores.
function ScoreTable({ ev }) {
  return (
    <div className="panel">
      <h3>Scores</h3>
      {ev.scores.length === 0 ? (
        <p className="muted">No scores yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Criterion</th>
              <th className="num">Weight</th>
              <th className="num">Score (1–5)</th>
            </tr>
          </thead>
          <tbody>
            {ev.scores.map((s) => (
              <tr key={s.criterionId}>
                <td>
                  <div className="strong">{s.criterion}</div>
                  {s.comment && <div className="muted small">{s.comment}</div>}
                </td>
                <td className="num">{s.weightUsed}%</td>
                <td className="num strong">{s.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Editable scores: one row per active criterion, a 1–5 choice and an optional comment.
function ScoreEditor({ ev, onSaved }) {
  const { data } = useApi('/evaluation-criteria', { appliesTo: ev.type, isActive: 'true' });
  const criteria = [...(data?.items ?? [])].sort((a, b) => b.weight - a.weight);
  const [scores, setScores] = useState({});
  const { run, busy, error } = useSubmit();
  const [saved, setSaved] = useState(false);

  // Start from the scores already saved.
  useEffect(() => {
    setScores(Object.fromEntries(ev.scores.map((s) => [s.criterionId, { score: s.score, comment: s.comment ?? '' }])));
  }, [ev.scores]);

  const setScore = (id, key, value) => {
    setSaved(false);
    setScores({ ...scores, [id]: { ...scores[id], [key]: value } });
  };
  const preview = previewScore(criteria, scores);

  function save() {
    const body = {
      scores: Object.entries(scores)
        .filter(([, s]) => s.score)
        .map(([criterionId, s]) => ({ criterionId, score: Number(s.score), comment: s.comment })),
    };
    run(() => api.put(`/evaluations/${ev.id}/scores`, body), () => {
      setSaved(true);
      onSaved();
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Scores</h3>
        <span className="muted small">1 = far below expectations · 5 = excellent</span>
      </div>
      <ErrorAlert error={error} />
      {saved && <Alert type="success">Scores saved.</Alert>}
      <div className="score-rows">
        {criteria.map((c) => (
          <div key={c.id} className="score-row">
            <div>
              <div className="strong">
                {c.name} <span className="muted small">({c.weight}%)</span>
              </div>
              {c.description && <div className="muted small">{c.description}</div>}
            </div>
            <div className="score-buttons" role="radiogroup" aria-label={`Score for ${c.name}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={Number(scores[c.id]?.score) === n}
                  className={`score-button ${Number(scores[c.id]?.score) === n ? 'selected' : ''}`}
                  onClick={() => setScore(c.id, 'score', n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              className="score-comment"
              placeholder="Comment (optional)"
              value={scores[c.id]?.comment ?? ''}
              onChange={(e) => setScore(c.id, 'comment', e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="panel-foot">
        <span className="muted">
          Preview: <strong>{preview === null ? 'score every criterion' : `${preview}%`}</strong>
        </span>
        <button className="btn btn-primary" onClick={save} disabled={busy || Object.keys(scores).length === 0}>
          {busy ? 'Saving…' : 'Save scores'}
        </button>
      </div>
    </div>
  );
}

function FeedbackView({ ev }) {
  return (
    <div className="panel">
      <h3>Feedback</h3>
      <p className="pre-wrap">{ev.feedback ?? <span className="muted">No feedback yet.</span>}</p>
      {ev.recommendations && (
        <>
          <h4>Recommendations</h4>
          <p className="pre-wrap">{ev.recommendations}</p>
        </>
      )}
    </div>
  );
}

function FeedbackEditor({ ev, onSaved }) {
  const [v, setV] = useState({ feedback: ev.feedback ?? '', recommendations: ev.recommendations ?? '' });
  const { run, busy, error } = useSubmit();
  const [saved, setSaved] = useState(false);
  return (
    <div className="panel">
      <h3>Feedback</h3>
      <ErrorAlert error={error} />
      {saved && <Alert type="success">Feedback saved.</Alert>}
      <div className="form-grid">
        <Field label="Feedback" hint="At least 20 characters before submitting. What went well, what can improve.">
          <textarea rows={5} value={v.feedback} onChange={(e) => { setSaved(false); setV({ ...v, feedback: e.target.value }); }} />
        </Field>
        <Field label="Recommendations">
          <textarea rows={3} value={v.recommendations} onChange={(e) => { setSaved(false); setV({ ...v, recommendations: e.target.value }); }} />
        </Field>
      </div>
      <div className="panel-foot">
        <span />
        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.patch(`/evaluations/${ev.id}`, v), () => { setSaved(true); onSaved(); })}>
          {busy ? 'Saving…' : 'Save feedback'}
        </button>
      </div>
    </div>
  );
}

function SubmitBox({ ev, onSaved }) {
  const { run, busy, error } = useSubmit();
  return (
    <div className="panel panel-highlight">
      <h3>Submit for approval</h3>
      <p className="muted">
        Save your scores and feedback first. After submitting, the evaluation can no longer be changed unless an approver returns it.
      </p>
      <ErrorAlert error={error} />
      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post(`/evaluations/${ev.id}/submit`), onSaved)}>
        {busy ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  );
}

function ReviewBox({ ev, onSaved }) {
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  const act = (path, body) => run(() => api.post(`/evaluations/${ev.id}/${path}`, body), () => {
    setComment('');
    onSaved();
  });

  if (ev.status === 'APPROVED') {
    return (
      <div className="panel panel-highlight">
        <h3>Publish</h3>
        <p className="muted small">After publishing, {ev.employee.firstName} can read the evaluation.</p>
        <ErrorAlert error={error} />
        <button className="btn btn-primary btn-block" disabled={busy} onClick={() => act('publish')}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    );
  }

  return (
    <div className="panel panel-highlight">
      <h3>Review</h3>
      <ErrorAlert error={error} />
      <Field label="Comment" hint="Optional when approving. Required when returning: say what to fix.">
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="button-row">
        <button className="btn btn-ghost" disabled={busy} onClick={() => act('return', { comment })}>
          Return to fix
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={() => act('approve', comment ? { comment } : {})}>
          Approve
        </button>
      </div>
    </div>
  );
}

function Acknowledge({ ev, onSaved }) {
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  if (ev.acknowledgedAt) {
    return <Alert type="success">You acknowledged this evaluation on {formatDate(ev.acknowledgedAt)}.</Alert>;
  }
  return (
    <div className="panel panel-highlight">
      <h3>Acknowledge</h3>
      <p className="muted">Confirm that you have read your evaluation. This does not mean you agree with everything. You can add one comment.</p>
      <ErrorAlert error={error} />
      <Field label="Your comment (optional)">
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post(`/evaluations/${ev.id}/acknowledge`, comment ? { comment } : {}), onSaved)}>
        {busy ? 'Saving…' : 'I have read my evaluation'}
      </button>
    </div>
  );
}
