// "Monthly progress" of an ACTIVE plan (version 2, Module 13).
//
//   1. Choose a month. Enter the real number of each KPI (the employee, or the Manager for a company plan).
//   2. The person who checks confirms it (the Manager, or the Holding for a company plan).
//      Only confirmed numbers count.
//   3. The summary shows each quarter, half and the year so far, with a traffic light:
//      green = on track (100%+), yellow = at risk (85–99%), red = off track (below 85%).
//   4. Both people can leave a comment on the month. No score here: scores come from the numbers (Module 16).

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, Badge, ErrorAlert, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { shortPeriodName } from '../../utils/planYears.js';
import { DIRECTION, formatNumber } from '../../utils/plans.js';
import { ACTUAL_STATE, LIGHT, defaultMonthId, parentsOf, summaryColumns, waitingInMonth } from '../../utils/progress.js';

export function ProgressSection({ planId }) {
  const { data, error, loading } = useApi(`/plans/${planId}/progress`);
  // After every change the server sends the whole progress again; we keep the newest copy here.
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    if (data) setProgress(data.progress);
  }, [data]);

  const [monthId, setMonthId] = useState('');
  if (loading && !progress) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!progress) return null;

  const months = progress.periods.filter((p) => p.type === 'MONTH');
  const selected = monthId || defaultMonthId(progress.periods);
  const month = months.find((m) => m.id === selected);

  return (
    <section className="progress-section">
      <div className="section-head">
        <h2 className="section-title">Monthly progress</h2>
        <div className="row-actions">
          {progress.waitingForConfirmation > 0 && <Badge tone="info">{progress.waitingForConfirmation} waiting for confirmation</Badge>}
          <select value={selected} onChange={(e) => setMonthId(e.target.value)} aria-label="Month">
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {shortPeriodName(m.name)} {m.status === 'OPEN' ? '' : m.status === 'CLOSED' ? '(closed)' : '(not open yet)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <MonthTable progress={progress} month={month} onChange={setProgress} />
      <Comments progress={progress} month={month} onChange={setProgress} />
      <Summary progress={progress} />
    </section>
  );
}

function MonthTable({ progress, month, onChange }) {
  const { run, busy, error } = useSubmit();
  const open = month.status === 'OPEN';
  const waiting = waitingInMonth(progress.kpis, month.id);

  return (
    <>
      <p className="muted small">
        {formatDate(month.startDate)} – {formatDate(month.endDate)} ·{' '}
        {month.status === 'OPEN' ? 'Open: numbers can be entered and confirmed.' : month.status === 'CLOSED' ? 'Closed: the numbers are frozen.' : 'Not open yet.'}
      </p>
      <ErrorAlert error={error} />
      {progress.can.confirm && open && waiting > 0 && (
        <Alert type="info">
          {waiting} number(s) of this month wait for your confirmation.{' '}
          <button className="btn btn-primary btn-small" disabled={busy} onClick={() => run(() => api.post(`/plans/${progress.plan.id}/months/${month.id}/confirm`), (d) => onChange(d.progress))}>
            Confirm all
          </button>
        </Alert>
      )}
      <div className="table-wrap">
        <table className="table progress-table">
          <thead>
            <tr>
              <th>KPI</th>
              <th className="num">Target</th>
              <th className="num">Actual</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {progress.kpis.map((kpi) => (
              <ActualRow key={`${kpi.id}-${month.id}`} progress={progress} kpi={kpi} month={month} onChange={onChange} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ActualRow({ progress, kpi, month, onChange }) {
  const row = kpi.months.find((m) => m.periodId === month.id);
  const [actual, setActual] = useState(row.actual ?? '');
  const [comment, setComment] = useState(row.comment ?? '');
  const { run, busy, error } = useSubmit();
  const open = month.status === 'OPEN';
  const editable = open && progress.can.enter;
  const changed = String(actual) !== String(row.actual ?? '') || comment !== (row.comment ?? '');
  const state = ACTUAL_STATE[row.state];

  const save = () =>
    run(() => api.put(`/kpis/${kpi.id}/months/${month.id}/actual`, { actual: Number(actual), comment }), (d) => onChange(d.progress));

  return (
    <tr>
      <td>
        <div className="strong">{kpi.name}</div>
        <div className="muted small">
          {DIRECTION[kpi.direction].short} · {kpi.unit}
        </div>
        {error && <div className="field-error">{error.details?.[0]?.message ?? error.message}</div>}
      </td>
      <td className="num">{formatNumber(row.target)}</td>
      <td className="num">
        {editable ? (
          <div className="actual-inputs">
            <input type="number" min="0" step="any" value={actual} onChange={(e) => setActual(e.target.value)} aria-label={`Actual for ${kpi.name}`} />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" aria-label={`Comment for ${kpi.name}`} />
          </div>
        ) : (
          <>
            <span className="strong">{formatNumber(row.actual)}</span>
            {row.comment && <div className="muted small">{row.comment}</div>}
          </>
        )}
      </td>
      <td>
        <Badge tone={state.tone}>{state.label}</Badge>
        {row.state !== 'EMPTY' && (
          <div className="muted small" title={row.confirmedAt ? `Confirmed ${formatDateTime(row.confirmedAt)}` : undefined}>
            {row.state === 'CONFIRMED' ? `by ${row.confirmedBy}` : `entered by ${row.enteredBy}`}
          </div>
        )}
      </td>
      <td className="row-actions">
        {editable && (
          <button className="btn btn-ghost btn-small" disabled={busy || !changed || actual === ''} onClick={save}>
            Save
          </button>
        )}
        {open && progress.can.confirm && row.state === 'ENTERED' && (
          <button className="btn btn-primary btn-small" disabled={busy} onClick={() => run(() => api.post(`/kpis/${kpi.id}/months/${month.id}/confirm`), (d) => onChange(d.progress))}>
            Confirm
          </button>
        )}
      </td>
    </tr>
  );
}

function Comments({ progress, month, onChange }) {
  if (progress.plan.level === 'HOLDING' || month.status === 'UPCOMING') return null;
  const review = progress.reviews.find((r) => r.periodId === month.id);
  const ownerLabel = progress.plan.level === 'COMPANY' ? 'Manager' : 'Employee';
  const reviewerLabel = progress.plan.level === 'COMPANY' ? 'Holding' : 'Manager';
  return (
    <div className="two-columns comments-grid">
      <CommentBox label={`${ownerLabel}'s comment`} text={review?.ownerComment} at={review?.ownerCommentAt} editable={progress.can.ownerComment} planId={progress.plan.id} periodId={month.id} onChange={onChange} />
      <CommentBox label={`${reviewerLabel}'s comment`} text={review?.reviewerComment} at={review?.reviewerCommentAt} editable={progress.can.reviewerComment} planId={progress.plan.id} periodId={month.id} onChange={onChange} />
    </div>
  );
}

function CommentBox({ label, text, at, editable, planId, periodId, onChange }) {
  const [value, setValue] = useState(text ?? '');
  const { run, busy, error } = useSubmit();
  useEffect(() => setValue(text ?? ''), [text, periodId]);
  return (
    <div className="panel">
      <h4>{label}</h4>
      {editable ? (
        <>
          <textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="How did this month go?" />
          <ErrorAlert error={error} />
          <button className="btn btn-ghost btn-small" disabled={busy || value.trim() === (text ?? '')} onClick={() => run(() => api.put(`/plans/${planId}/reviews/${periodId}`, { comment: value }), (d) => onChange(d.progress))}>
            Save comment
          </button>
        </>
      ) : (
        <p className={text ? '' : 'muted'}>{text || 'No comment yet.'}</p>
      )}
      {at && <div className="muted small">{formatDateTime(at)}</div>}
    </div>
  );
}

function Summary({ progress }) {
  const columns = summaryColumns(progress.periods);
  return (
    <>
      <h3 className="section-title">Quarters, halves and the year so far</h3>
      <p className="muted small">
        Only confirmed numbers count, compared with the target of the same months. Green = 100% or more · yellow = 85–99% · red = below 85% (achievement counted up to{' '}
        {progress.plan.planYear.achievementCap}%).
      </p>
      <div className="table-wrap">
        <table className="table summary-table">
          <thead>
            <tr>
              <th>KPI</th>
              {columns.map((c) => (
                <th key={c.id} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {progress.kpis.map((kpi) => (
              <tr key={kpi.id}>
                <td className="strong">{kpi.name}</td>
                {columns.map((c) => {
                  const s = kpi.summary[c.id];
                  return (
                    <td key={c.id} className="num" title={s.light ? `${formatNumber(s.actual)} of ${formatNumber(s.targetSoFar)} ${kpi.unit} (${s.monthsKnown} of ${s.monthsTotal} months)` : 'No confirmed numbers yet'}>
                      {s.light ? (
                        <>
                          <span className={`light light-${s.light.toLowerCase()}`} aria-label={LIGHT[s.light].label} /> {s.achievement}%
                          <div className="muted small">
                            {formatNumber(s.actual)} / {formatNumber(s.targetSoFar)}
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
