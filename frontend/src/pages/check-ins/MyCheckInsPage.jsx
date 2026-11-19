// Employee: "Weekly check-ins" (version 2, Module 14).
//
// Each week, 3 short answers: what I did, what comes next, what is blocking me. The Manager can reply.
// There is no score: these notes help you and your Manager remember the year at evaluation time.
// You can write this week or last week, and change (or delete) a note until the Manager replies.

import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError } from '../../utils/format.js';
import { weekLabel, weekName } from '../../utils/checkIns.js';
import { CheckInAnswers, CheckInReply } from './CheckInNote.jsx';

export function MyCheckInsPage() {
  const status = useApi('/check-ins/status');
  const list = useApi('/check-ins', { pageSize: 100 });
  const [week, setWeek] = useState('');
  const [notice, setNotice] = useState(''); // "Saved." / "Deleted." — kept here because the form is rebuilt after saving
  const chooseWeek = (w) => {
    setWeek(w);
    setNotice('');
  };

  if ((status.loading && !status.data) || (list.loading && !list.data)) return <Spinner />;
  const error = status.error || list.error;
  if (error) return <ErrorAlert error={error} />;

  const { enabled, thisWeek, lastWeek } = status.data.status;
  const items = list.data.items;
  const selected = week || thisWeek;
  const current = items.find((c) => c.weekStart === selected);

  return (
    <div className="page">
      <PageHeader title="Weekly check-ins" subtitle="A few lines each week. No score: it helps you and your Manager remember the year." />

      {!enabled && <Alert type="info">Weekly check-ins are switched off by the Head. Your old notes are below.</Alert>}

      {enabled && (
        <div className="panel">
          <div className="panel-head">
            <h3>{weekName(selected, thisWeek)}</h3>
            <div className="tabs" role="tablist">
              {[thisWeek, lastWeek].map((w) => (
                <button key={w} role="tab" aria-selected={w === selected} className={`tab ${w === selected ? 'active' : ''}`} onClick={() => chooseWeek(w)}>
                  {weekName(w, thisWeek)}
                </button>
              ))}
            </div>
          </div>
          <p className="muted small">{weekLabel(selected)}</p>
          <Alert type="success">{notice}</Alert>
          {current && !current.can.edit ? (
            <>
              <CheckInAnswers checkIn={current} />
              <CheckInReply checkIn={current} />
            </>
          ) : (
            <CheckInForm
              key={`${selected}-${current?.id ?? 'new'}`}
              weekStart={selected}
              checkIn={current}
              onSaved={(message) => {
                setNotice(message);
                list.reload();
              }}
            />
          )}
        </div>
      )}

      <h2 className="section-title">All my check-ins</h2>
      {items.length === 0 ? (
        <EmptyState>No check-ins yet.</EmptyState>
      ) : (
        items.map((c) => (
          <div className="panel" key={c.id}>
            <div className="panel-head">
              <h3>{weekName(c.weekStart, thisWeek)}</h3>
              <span className="muted small">{weekLabel(c.weekStart)}</span>
            </div>
            <CheckInAnswers checkIn={c} />
            <CheckInReply checkIn={c} />
          </div>
        ))
      )}
    </div>
  );
}

function CheckInForm({ weekStart, checkIn, onSaved }) {
  // The form starts with the saved note (if there is one). It is rebuilt when the week or the note changes (see its key).
  const [values, setValues] = useState(() => ({ done: checkIn?.done ?? '', next: checkIn?.next ?? '', blockers: checkIn?.blockers ?? '' }));
  const { run, busy, error } = useSubmit();

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    run(() => api.put(`/check-ins/mine/${weekStart}`, values), () => onSaved('Saved. You can still change it until your Manager replies.'));
  };
  const remove = () =>
    run(() => api.delete(`/check-ins/mine/${weekStart}`), () => onSaved('Deleted.'));

  return (
    <form onSubmit={save} className="checkin-form">
      <ErrorAlert error={error} inForm />
      <Field label="What did I do this week?" error={fieldError(error, 'done')}>
        <textarea rows={3} value={values.done} onChange={set('done')} maxLength={1000} />
      </Field>
      <Field label="What will I do next week?" error={fieldError(error, 'next')}>
        <textarea rows={3} value={values.next} onChange={set('next')} maxLength={1000} />
      </Field>
      <Field label="Is anything blocking me? (optional)" error={fieldError(error, 'blockers')} hint="For example: waiting for a spare part, a decision, or information from someone.">
        <textarea rows={2} value={values.blockers} onChange={set('blockers')} maxLength={1000} />
      </Field>
      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {checkIn ? 'Save changes' : 'Save check-in'}
        </button>
        {checkIn && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
