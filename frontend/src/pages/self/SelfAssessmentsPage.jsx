// Self-assessments (SRS FR-06).
//   • Employee: write their own, save drafts, submit once.
//   • Manager: two tabs — "My team" (who has submitted, and what they wrote) and "My own".
// A draft is private: nobody else can read it. After submitting, it is locked.

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { ConfirmDialog } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { PeriodSelect } from '../../components/PeriodSelect.jsx';
import { Alert, Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { defaultPeriodId, usePeriods } from '../../hooks/usePeriods.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { formatDate, formatDateTime, fullName, humanize } from '../../utils/format.js';

const STATUS_TONE = { NOT_STARTED: 'neutral', DRAFT: 'warn', SUBMITTED: 'good' };
const MIN_LENGTH = 20;

export function SelfAssessmentsPage() {
  const { user } = useAuth();
  const isManager = user.role === 'MANAGER';
  const { periods } = usePeriods();
  const [periodId, setPeriodId] = useState('');
  const [tab, setTab] = useState(isManager ? 'team' : 'mine');

  // Choose the open (or latest) period once — never overwrite the user's choice.
  useEffect(() => {
    if (periods.length > 0) setPeriodId((current) => current || defaultPeriodId(periods));
  }, [periods]);

  return (
    <div className="page">
      <PageHeader
        title={isManager ? 'Self-assessments' : 'Self-assessment'}
        subtitle="In your own words: what went well, what was difficult, and what you want to improve."
      />
      <div className="toolbar">
        <PeriodSelect periods={periods} value={periodId} onChange={setPeriodId} />
      </div>
      {isManager && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'team'} className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
            My team
          </button>
          <button role="tab" aria-selected={tab === 'mine'} className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
            My own
          </button>
        </div>
      )}
      {periodId && tab === 'mine' && <MySelfAssessment key={periodId} periodId={periodId} />}
      {periodId && tab === 'team' && <TeamOverview periodId={periodId} />}
    </div>
  );
}

function MySelfAssessment({ periodId }) {
  const { data, error, loading, reload } = useApi(`/self-assessments/mine/${periodId}`);
  const [comments, setComments] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { run, busy, error: saveError } = useSubmit();

  // Fill the text box with the saved draft when it arrives.
  useEffect(() => {
    if (data) setComments(data.selfAssessment?.comments ?? '');
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;

  const sa = data.selfAssessment;
  const submitted = sa?.status === 'SUBMITTED';
  const open = data.period.status === 'OPEN';

  const saveDraft = () =>
    run(() => api.put(`/self-assessments/mine/${periodId}`, { comments }), () => {
      setMessage('Draft saved. Only you can see it.');
      reload();
    });

  // Submitting saves the latest text first, so nothing typed is lost.
  const submit = () =>
    run(
      async () => {
        await api.put(`/self-assessments/mine/${periodId}`, { comments });
        return api.post(`/self-assessments/mine/${periodId}/submit`);
      },
      () => {
        setConfirming(false);
        setMessage('');
        reload();
      },
    );

  return (
    <div className="detail-grid">
      <div className="detail-main">
        <div className="panel">
          <div className="panel-head">
            <h3>{data.period.name}</h3>
            <Badge tone={STATUS_TONE[sa?.status ?? 'NOT_STARTED']}>{humanize(sa?.status ?? 'NOT_STARTED')}</Badge>
          </div>
          {submitted && <Alert type="success">Submitted on {formatDateTime(sa.submittedAt)}. It can no longer be changed.</Alert>}
          {!submitted && !open && <Alert type="info">This period is {data.period.status.toLowerCase()}, so self-assessments cannot be written now.</Alert>}
          <Alert type="success">{message}</Alert>
          <ErrorAlert error={saveError} />
          {submitted ? (
            <p className="pre-wrap">{sa.comments}</p>
          ) : (
            <>
              <Field label="My self-assessment" hint={`${comments.trim().length} characters · at least ${MIN_LENGTH} to submit`}>
                <textarea
                  rows={10}
                  value={comments}
                  disabled={!open}
                  onChange={(e) => {
                    setMessage('');
                    setComments(e.target.value);
                  }}
                />
              </Field>
              {open && (
                <div className="panel-foot">
                  <span className="muted small">A draft is private. Your Manager sees it only after you submit.</span>
                  <div className="button-row">
                    <button className="btn btn-ghost" onClick={saveDraft} disabled={busy}>
                      Save draft
                    </button>
                    <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={busy || comments.trim().length < MIN_LENGTH}>
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <aside className="detail-side">
        <div className="panel">
          <h3>My goals in this period</h3>
          {data.goals.length === 0 ? (
            <p className="muted">No goals linked to this period.</p>
          ) : (
            <ul className="timeline">
              {data.goals.map((g) => (
                <li key={g.id}>
                  <div className="strong">{g.title}</div>
                  <div className="small muted">
                    {g.progressPercent}% · {humanize(g.status)}
                    {g.deadline && ` · deadline ${formatDate(g.deadline)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      {confirming && (
        <ConfirmDialog
          title="Submit self-assessment"
          message="After submitting, you cannot change it any more. Your Manager and the Holding will be able to read it."
          confirmLabel="Submit"
          busy={busy}
          onClose={() => setConfirming(false)}
          onConfirm={submit}
        >
          <ErrorAlert error={saveError} />
        </ConfirmDialog>
      )}
    </div>
  );
}

function TeamOverview({ periodId }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi('/self-assessments', { periodId, status, page });
  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="">Everyone</option>
          <option value="NOT_STARTED">Not started</option>
          <option value="DRAFT">Draft (private)</option>
          <option value="SUBMITTED">Submitted</option>
        </select>
      </div>
      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>Nobody matches this filter.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.employee.id}>
                  <td>
                    <div className="strong">{fullName(row.employee)}</div>
                    <div className="muted small">{row.employee.employeeNumber}</div>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[row.status]}>{humanize(row.status)}</Badge>
                  </td>
                  <td className="small">{formatDateTime(row.submittedAt)}</td>
                  <td className="row-actions">
                    {row.comments && (
                      <button className="btn btn-ghost btn-small" onClick={() => setOpen(open === row.employee.id ? null : row.employee.id)}>
                        {open === row.employee.id ? 'Hide' : 'Read'}
                      </button>
                    )}
                    {open === row.employee.id && <div className="details-box pre-wrap">{row.comments}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={setPage} />
    </>
  );
}
