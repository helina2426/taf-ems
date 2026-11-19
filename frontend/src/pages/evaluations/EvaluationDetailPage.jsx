// One evaluation, with everything that can be done to it — depending on who is looking:
//   • the evaluator (Manager, or an approver for a Manager evaluation): scores, feedback, submit
//   • an approver: approve, return with a reason, publish
//   • the person evaluated (after publication): read it and acknowledge it
// The backend checks every action again; the page only shows the buttons that make sense.
//
// Version 2 (Module 16): a plan-based evaluation (mid-year review or annual evaluation) also shows
// the KPI scores — calculated by the system from the confirmed monthly numbers — and the rating.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { levelHint } from '../../utils/behaviours.js';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { KIND_LABEL, RATING_LABEL, RATING_TONE, STATUS_LABEL, STATUS_TONE, canWrite, isApprover, previewScore, previewV2 } from '../../utils/evaluations.js';
import { DIRECTION, formatNumber } from '../../utils/plans.js';
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
        subtitle={`${ev.kind ? KIND_LABEL[ev.kind] : ev.type === 'MANAGER' ? 'Manager evaluation' : 'Employee evaluation'}${ev.kind && ev.type === 'MANAGER' ? ' (Manager)' : ''} · ${ev.company.name} · ${ev.kind ? ev.planYear.name : ev.period.name}`}
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
          {ev.kind && <KpiResults ev={ev} live={['DRAFT', 'RETURNED'].includes(ev.status)} />}
          {writable ? <ScoreEditor ev={ev} onSaved={reload} /> : <ScoreTable ev={ev} />}
          {writable ? <FeedbackEditor ev={ev} onSaved={reload} /> : <FeedbackView ev={ev} />}
          {writable && <SubmitBox ev={ev} onSaved={reload} />}
          {isPerson && ev.status === 'PUBLISHED' && <Acknowledge ev={ev} onSaved={reload} />}
        </div>

        <aside className="detail-side">
          {ev.kind ? (
            <RatingPanel ev={ev} />
          ) : (
            <div className="panel score-panel">
              <div className="stat-label">Overall score</div>
              <div className="score-big">{percent(ev.overallScore)}</div>
              {ev.overallScore === null && <div className="muted small">Shown when every criterion has a score.</div>}
            </div>
          )}

          {isApprover(user) && ['SUBMITTED', 'APPROVED'].includes(ev.status) && <ReviewBox ev={ev} onSaved={reload} />}

          {!isPerson && !ev.kind && (
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
      <h3>{ev.kind ? `Behaviours (${ev.behaviourPart} points)` : 'Scores'}</h3>
      {ev.scores.length === 0 ? (
        <p className="muted">No scores yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{ev.kind ? 'Behaviour' : 'Criterion'}</th>
              <th className="num">{ev.kind ? 'Points' : 'Weight'}</th>
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
                <td className="num">{ev.kind ? `${formatNumber((s.score / 5) * s.weightUsed)} / ${s.weightUsed}` : `${s.weightUsed}%`}</td>
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
  // Version 2: behaviours count in points (e.g. Safety 20% of 30 points = 6 points).
  const pointsOf = Object.fromEntries((ev.behaviours ?? []).map((b) => [b.criterionId, b.weightPoints]));
  const v2Preview = ev.kind ? previewV2(ev.resultsScore, ev.behaviours, scores, { safetyCapEnabled: ev.planYear.safetyCapEnabled }) : null;

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
        <h3>{ev.kind ? `Behaviours (${ev.behaviourPart} points)` : 'Scores'}</h3>
        <span className="muted small">1 = far below expectations · 5 = excellent</span>
      </div>
      <ErrorAlert error={error} />
      {saved && <Alert type="success">Scores saved.</Alert>}
      <div className="score-rows">
        {criteria.map((c) => (
          <div key={c.id} className="score-row">
            <div>
              <div className="strong">
                {c.name} <span className="muted small">({ev.kind ? `${pointsOf[c.id] ?? '—'} points` : `${c.weight}%`})</span>
              </div>
              {c.description && <div className="muted small">{c.description}</div>}
              {/* Version 2: what the chosen score means for this behaviour. */}
              {scores[c.id]?.score && <div className="score-level small">{levelHint(c, Number(scores[c.id].score))}</div>}
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
                  title={levelHint(c, n)}
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
          Preview:{' '}
          <strong>
            {ev.kind
              ? v2Preview
                ? `${v2Preview.overallScore} / 100 · ${RATING_LABEL[v2Preview.rating]}`
                : ev.resultsScore === null
                  ? 'waiting for confirmed KPI numbers'
                  : 'score every behaviour'
              : preview === null
                ? 'score every criterion'
                : `${preview}%`}
          </strong>
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

// Version 2: the KPI scores. Calculated by the system from the confirmed monthly numbers;
// while the evaluation can still change they are calculated again each time the page loads.
function KpiResults({ ev, live }) {
  return (
    <div className="panel kpi-panel">
      <div className="panel-head">
        <h3>Results — KPIs ({ev.resultsShare} points)</h3>
        <span className="muted small">{live ? 'Calculated now from the confirmed monthly numbers' : 'Saved when the evaluation was submitted'}</span>
      </div>
      {ev.planMissing ? (
        <p className="muted">The plan is not active, so the KPI scores cannot be calculated.</p>
      ) : (
        <div className="table-wrap">
          <table className="table kpi-results">
            <thead>
              <tr>
                <th>KPI</th>
                <th className="num">Target</th>
                <th className="num">Actual</th>
                <th className="num">Achieved</th>
                <th className="num">Score</th>
                <th className="num">Points</th>
              </tr>
            </thead>
            <tbody>
              {ev.kpiScores.map((k) => (
                <tr key={k.kpiId}>
                  <td>
                    <div className="strong">{k.name}</div>
                    <div className="muted small">
                      {k.direction && DIRECTION[k.direction]?.short} · {k.unit}
                      {k.monthsUsed !== null && ` · ${k.monthsUsed}${k.monthsTotal ? ` of ${k.monthsTotal}` : ''} months confirmed`}
                    </div>
                  </td>
                  <td className="num">{formatNumber(k.targetUsed)}</td>
                  <td className="num">{formatNumber(k.actualUsed)}</td>
                  <td className="num">{k.achievementPercent === null ? '—' : `${k.achievementPercent}%`}</td>
                  <td className="num strong">{k.score ?? '—'}</td>
                  <td className="num">{k.points === null ? '—' : `${formatNumber(k.points)} / ${k.weight}`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="strong">
                  Results
                </td>
                <td className="num strong">{ev.resultsScore === null ? '—' : `${formatNumber(ev.resultsScore)} / ${ev.resultsShare}`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="muted small">
        Score: 110%+ → 5 · 100–109% → 4 · 85–99% → 3 · 70–84% → 2 · below 70% → 1. Points = score ÷ 5 × the KPI weight. The target is the target of the
        months that have a confirmed number.
      </p>
    </div>
  );
}

// Version 2: the rating, and how the 100 points are made.
function RatingPanel({ ev }) {
  return (
    <div className="panel score-panel">
      <div className="stat-label">Rating</div>
      {ev.rating ? (
        <div className="rating-big">
          <Badge tone={RATING_TONE[ev.rating]}>{RATING_LABEL[ev.rating]}</Badge>
        </div>
      ) : (
        <div className="muted small">Shown when every KPI has a confirmed number and every behaviour has a score.</div>
      )}
      <div className="score-big">{ev.overallScore === null ? '—' : ev.overallScore}</div>
      <div className="muted small">out of 100</div>
      <dl className="facts">
        <dt>Results (KPIs)</dt>
        <dd>{ev.resultsScore === null ? '—' : `${formatNumber(ev.resultsScore)} / ${ev.resultsShare}`}</dd>
        <dt>Behaviours</dt>
        <dd>{ev.behaviourScore === null ? '—' : `${formatNumber(ev.behaviourScore)} / ${ev.behaviourPart}`}</dd>
      </dl>
      {ev.safetyCapApplied && <Alert type="info">The safety rule lowered the rating: Safety was scored 1.</Alert>}
      <p className="muted small">90+ Exceeds · 75–89 Successfully meets · 55–74 Partially meets · below 55 Does not meet</p>
    </div>
  );
}
