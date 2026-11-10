// Performance goals (SRS FR-05).
//   • Manager: the goals of their team — create, edit, cancel, reopen, and see progress history.
//   • Employee: "My goals" — report progress (a percentage and a comment).
// The status follows the progress automatically: 0% not started, 1–99% in progress, 100% completed.

import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { ConfirmDialog, FormModal, Modal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { usePeriods } from '../../hooks/usePeriods.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate, formatDateTime, fullName, humanize, withoutEmpty } from '../../utils/format.js';

const GOAL_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const GOAL_TONE = { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'good', CANCELLED: 'bad' };

export function GoalsPage() {
  const { user } = useAuth();
  const isManager = user.role === 'MANAGER';
  const [filters, setFilters] = useState({ status: '', employeeId: '', page: 1 });
  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });
  const { data, error, loading, reload } = useApi('/goals', { ...filters, pageSize: 50 });
  const team = useApi(isManager ? '/employees' : null, { pageSize: 100 });
  const [dialog, setDialog] = useState(null); // { type, goal }
  const close = () => setDialog(null);

  return (
    <div className="page">
      <PageHeader
        title={isManager ? 'Goals' : 'My goals'}
        subtitle={isManager ? `Goals of the ${user.companyName} team.` : 'Report your progress as you go. 100% marks a goal as completed.'}
        actions={
          isManager && (
            <button className="btn btn-primary" onClick={() => setDialog({ type: 'form' })}>
              + New goal
            </button>
          )
        }
      />

      <div className="toolbar">
        <select value={filters.status} onChange={setFilter('status')} aria-label="Status">
          <option value="">All statuses</option>
          {GOAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        {isManager && (
          <select value={filters.employeeId} onChange={setFilter('employeeId')} aria-label="Employee">
            <option value="">Whole team</option>
            {(team.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No goals yet.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="goal-grid">
          {data.items.map((goal) => (
            <div key={goal.id} className={`goal-card ${goal.status === 'CANCELLED' ? 'inactive' : ''}`}>
              <div className="goal-card-head">
                <div>
                  <div className="strong">{goal.title}</div>
                  {isManager && <div className="muted small">{fullName(goal.employee)}</div>}
                </div>
                <Badge tone={GOAL_TONE[goal.status]}>{humanize(goal.status)}</Badge>
              </div>
              {goal.kpi && (
                <div className="small">
                  <span className="muted">KPI:</span> {goal.kpi}
                </div>
              )}
              {goal.targetResult && (
                <div className="small">
                  <span className="muted">Target:</span> {goal.targetResult}
                </div>
              )}
              <div className="progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${goal.progressPercent}%` }} />
                </div>
                <span className="progress-value">{goal.progressPercent}%</span>
              </div>
              <div className="small muted">
                {goal.deadline ? `Deadline ${formatDate(goal.deadline)}` : 'No deadline'}
                {goal.isOverdue && (
                  <>
                    {' '}
                    <Badge tone="bad">Overdue</Badge>
                  </>
                )}
                {goal.period && ` · ${goal.period.name}`}
              </div>
              <div className="goal-actions">
                <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'details', goal })}>
                  Details
                </button>
                {!isManager && goal.status !== 'CANCELLED' && (
                  <button className="btn btn-primary btn-small" onClick={() => setDialog({ type: 'progress', goal })}>
                    Update progress
                  </button>
                )}
                {isManager && goal.status !== 'CANCELLED' && (
                  <>
                    <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'form', goal })}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'cancel', goal })}>
                      Cancel goal
                    </button>
                  </>
                )}
                {isManager && goal.status === 'CANCELLED' && (
                  <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: 'reopen', goal })}>
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters({ ...filters, page })} />

      {dialog?.type === 'form' && <GoalForm goal={dialog.goal} team={team.data?.items ?? []} onClose={close} onSaved={reload} />}
      {dialog?.type === 'progress' && <ProgressForm goal={dialog.goal} onClose={close} onSaved={reload} />}
      {dialog?.type === 'details' && <GoalDetails goal={dialog.goal} onClose={close} />}
      {['cancel', 'reopen'].includes(dialog?.type) && <CancelOrReopen goal={dialog.goal} action={dialog.type} onClose={close} onSaved={reload} />}
    </div>
  );
}

const GOAL_FIELDS = ['title', 'description', 'objectives', 'kpi', 'targetResult', 'deadline'];

function GoalForm({ goal, team, onClose, onSaved }) {
  const isNew = !goal;
  const { periods } = usePeriods();
  const [v, setV] = useState({
    employeeId: '',
    ...Object.fromEntries(GOAL_FIELDS.map((k) => [k, goal?.[k] ?? ''])),
    periodId: goal?.period?.id ?? '',
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const { run, busy, error } = useSubmit();
  const err = (key) => fieldError(error, key);

  function save(event) {
    event.preventDefault();
    if (isNew) {
      run(() => api.post('/goals', withoutEmpty(v)), () => {
        onSaved();
        onClose();
      });
    } else {
      // Edit: send every field (so one can also be cleared). "No period" is sent as null.
      const { employeeId, ...rest } = v;
      run(() => api.patch(`/goals/${goal.id}`, { ...rest, periodId: rest.periodId || null }), () => {
        onSaved();
        onClose();
      });
    }
  }

  return (
    <FormModal title={isNew ? 'New goal' : 'Edit goal'} formId="goal-form" busy={busy} onClose={onClose} submitLabel={isNew ? 'Create' : 'Save'} wide>
      <form id="goal-form" className="form-grid form-grid-2" onSubmit={save} noValidate>
        <div className="span-2">
          <ErrorAlert error={error} inForm />
        </div>
        {isNew && (
          <Field label="Employee *" error={err('employeeId')}>
            <select value={v.employeeId} onChange={set('employeeId')}>
              <option value="">— Choose —</option>
              {team
                .filter((e) => ['ACTIVE', 'ON_LEAVE'].includes(e.employmentStatus))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e)}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Evaluation period" error={err('periodId')} hint="Optional. Goals of a closed period are locked.">
          <select value={v.periodId} onChange={set('periodId')}>
            <option value="">— None —</option>
            {periods
              .filter((p) => p.status !== 'CLOSED' || p.id === v.periodId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="span-2">
          <Field label="Title *" error={err('title')}>
            <input value={v.title} onChange={set('title')} autoFocus />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Description" error={err('description')}>
            <textarea rows={2} value={v.description} onChange={set('description')} />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Objectives" error={err('objectives')}>
            <textarea rows={2} value={v.objectives} onChange={set('objectives')} />
          </Field>
        </div>
        <Field label="KPI (how it is measured)" error={err('kpi')}>
          <input value={v.kpi} onChange={set('kpi')} />
        </Field>
        <Field label="Target result" error={err('targetResult')}>
          <input value={v.targetResult} onChange={set('targetResult')} />
        </Field>
        <Field label="Deadline" error={err('deadline')}>
          <input type="date" value={v.deadline} onChange={set('deadline')} />
        </Field>
      </form>
    </FormModal>
  );
}

function ProgressForm({ goal, onClose, onSaved }) {
  const [progressPercent, setProgress] = useState(goal.progressPercent);
  const [comment, setComment] = useState('');
  const { run, busy, error } = useSubmit();
  return (
    <FormModal title={`Progress: ${goal.title}`} formId="progress-form" busy={busy} onClose={onClose}>
      <form
        id="progress-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post(`/goals/${goal.id}/progress`, { progressPercent: Number(progressPercent), comment }), () => {
            onSaved();
            onClose();
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        <Field label={`Progress: ${progressPercent}%`} error={fieldError(error, 'progressPercent')} hint="100% marks the goal as completed.">
          <input type="range" min="0" max="100" step="5" value={progressPercent} onChange={(e) => setProgress(e.target.value)} />
        </Field>
        <Field label="What did you do? (optional)" error={fieldError(error, 'comment')}>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </form>
    </FormModal>
  );
}

function GoalDetails({ goal, onClose }) {
  const { data, loading, error } = useApi(`/goals/${goal.id}`);
  const g = data?.goal ?? goal;
  return (
    <Modal title={g.title} onClose={onClose} wide>
      {loading && <Spinner />}
      <ErrorAlert error={error} />
      <dl className="facts">
        <dt>Employee</dt>
        <dd>{fullName(g.employee)}</dd>
        <dt>Status</dt>
        <dd>
          <Badge tone={GOAL_TONE[g.status]}>{humanize(g.status)}</Badge> {g.progressPercent}%
        </dd>
        <dt>Deadline</dt>
        <dd>{formatDate(g.deadline)}</dd>
        <dt>Period</dt>
        <dd>{g.period?.name ?? '—'}</dd>
        <dt>Description</dt>
        <dd className="pre-wrap">{g.description ?? '—'}</dd>
        <dt>Objectives</dt>
        <dd className="pre-wrap">{g.objectives ?? '—'}</dd>
        <dt>KPI</dt>
        <dd>{g.kpi ?? '—'}</dd>
        <dt>Target</dt>
        <dd>{g.targetResult ?? '—'}</dd>
        <dt>Set by</dt>
        <dd>{g.createdBy ?? '—'}</dd>
      </dl>
      <h4>Progress history</h4>
      {(g.progressHistory ?? []).length === 0 ? (
        <p className="muted">No progress reported yet.</p>
      ) : (
        <ul className="timeline">
          {[...g.progressHistory].reverse().map((h, i) => (
            <li key={i}>
              <strong>{h.progressPercent}%</strong> <span className="muted small">· {formatDateTime(h.updatedAt)}</span>
              {h.comment && <div className="pre-wrap">{h.comment}</div>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CancelOrReopen({ goal, action, onClose, onSaved }) {
  const { run, busy, error } = useSubmit();
  const cancel = action === 'cancel';
  return (
    <ConfirmDialog
      title={cancel ? 'Cancel goal' : 'Reopen goal'}
      message={
        cancel
          ? `"${goal.title}" will be cancelled. ${goal.employee.firstName} can no longer report progress on it. Nothing is deleted, and you can reopen it.`
          : `"${goal.title}" will be active again, with its old progress (${goal.progressPercent}%).`
      }
      confirmLabel={cancel ? 'Cancel goal' : 'Reopen'}
      danger={cancel}
      busy={busy}
      onClose={onClose}
      onConfirm={() =>
        run(() => api.post(`/goals/${goal.id}/${action}`), () => {
          onSaved();
          onClose();
        })
      }
    >
      <ErrorAlert error={error} />
    </ConfirmDialog>
  );
}
