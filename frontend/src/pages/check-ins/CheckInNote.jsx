// One weekly check-in: the employee's 3 answers and the Manager's reply.
// The Manager sees a reply box (the server says when: checkIn.can.reply).

import { useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorAlert } from '../../components/ui.jsx';
import { useSubmit } from '../../hooks/useSubmit.js';
import { formatDateTime } from '../../utils/format.js';

export function CheckInAnswers({ checkIn }) {
  return (
    <dl className="checkin-answers">
      <dt>What I did</dt>
      <dd className="pre-wrap">{checkIn.done}</dd>
      <dt>What comes next</dt>
      <dd className="pre-wrap">{checkIn.next}</dd>
      <dt>Blockers</dt>
      <dd className={checkIn.blockers ? 'pre-wrap' : 'muted'}>{checkIn.blockers || 'None'}</dd>
    </dl>
  );
}

export function CheckInReply({ checkIn, onChange }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(checkIn.reply ?? '');
  const { run, busy, error } = useSubmit();

  const save = () =>
    run(() => api.put(`/check-ins/${checkIn.id}/reply`, { reply: text }), (d) => {
      setEditing(false);
      onChange?.(d.checkIn);
    });

  if (checkIn.can.reply && (editing || !checkIn.reply)) {
    return (
      <div className="checkin-reply">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to this note (for example: thanks, a tip, or how you will help with the blocker)" aria-label="Your reply" />
        <ErrorAlert error={error} />
        <div className="button-row">
          <button className="btn btn-primary btn-small" disabled={busy || text.trim().length < 2} onClick={save}>
            {checkIn.reply ? 'Save reply' : 'Reply'}
          </button>
          {editing && (
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!checkIn.reply) return <p className="muted small">No reply from the Manager yet.</p>;
  return (
    <div className="checkin-reply checkin-reply-done">
      <div className="small strong">Manager&apos;s reply</div>
      <p className="pre-wrap">{checkIn.reply}</p>
      <div className="muted small">
        {checkIn.repliedBy} · {formatDateTime(checkIn.repliedAt)}
        {checkIn.can.reply && (
          <>
            {' · '}
            <button className="link-button" onClick={() => setEditing(true)}>
              Change reply
            </button>
          </>
        )}
      </div>
    </div>
  );
}
