// Reports (SRS FR-09).
//   • Holding: completion per company, company comparison (with the consolidated Holding view),
//     Manager performance.
//   • Manager: completion of their own company.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { PeriodSelect } from '../../components/PeriodSelect.jsx';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner, StatCard } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { defaultPeriodId, usePeriods } from '../../hooks/usePeriods.js';
import { fullName, percent } from '../../utils/format.js';

const TABS = [
  { key: 'completion', label: 'Completion', roles: ['HOLDING', 'MANAGER'] },
  { key: 'companies', label: 'Compare companies', roles: ['HOLDING'] },
  { key: 'managers', label: 'Manager performance', roles: ['HOLDING'] },
];

export function ReportsPage() {
  const { user } = useAuth();
  const tabs = TABS.filter((t) => t.roles.includes(user.role));
  const [tab, setTab] = useState(tabs[0].key);
  const { periods } = usePeriods();
  const [periodId, setPeriodId] = useState('');

  // Choose the open (or latest) period once the list arrives — unless the user already chose one.
  useEffect(() => {
    if (periods.length > 0) setPeriodId((current) => current || defaultPeriodId(periods));
  }, [periods]);

  return (
    <div className="page">
      <PageHeader title="Reports" subtitle="Only approved or published results count in scores and completion." />
      <div className="toolbar">
        <PeriodSelect periods={periods} value={periodId} onChange={setPeriodId} />
      </div>
      {tabs.length > 1 && (
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {periodId && tab === 'completion' && <CompletionReport periodId={periodId} />}
      {periodId && tab === 'companies' && <CompanyComparison periodId={periodId} />}
      {periodId && tab === 'managers' && <ManagerPerformance periodId={periodId} />}
    </div>
  );
}

function useReport(path, periodId) {
  return useApi(path, { periodId });
}

function CompletionReport({ periodId }) {
  const { data, error, loading } = useReport('/reports/completion', periodId);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const t = data.totals;
  return (
    <>
      <div className="stat-grid">
        <StatCard label="To evaluate" value={t.toEvaluate} />
        <StatCard label="Not started" value={t.notStarted} tone={t.notStarted > 0 ? 'warn' : 'default'} />
        <StatCard label="In progress" value={t.inProgress} hint="Drafts and returned" />
        <StatCard label="Waiting for approval" value={t.pendingApproval} />
        <StatCard label="Completed" value={t.completed} tone="good" hint="Approved or published" />
        <StatCard label="Completion rate" value={percent(t.completionRate)} tone="good" />
      </div>
      <h2 className="section-title">By company</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th className="num">To evaluate</th>
              <th className="num">Not started</th>
              <th className="num">In progress</th>
              <th className="num">Waiting</th>
              <th className="num">Completed</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {data.companies.map((row) => (
              <tr key={row.company.id}>
                <td className="strong">{row.company.name}</td>
                <td className="num">{row.toEvaluate}</td>
                <td className="num">{row.notStarted}</td>
                <td className="num">{row.inProgress}</td>
                <td className="num">{row.pendingApproval}</td>
                <td className="num">{row.completed}</td>
                <td>
                  <ProgressBar value={row.completionRate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompanyComparison({ periodId }) {
  const { data, error, loading } = useReport('/reports/companies', periodId);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const c = data.consolidated;
  return (
    <>
      <h2 className="section-title">Whole Holding</h2>
      <div className="stat-grid">
        <StatCard label="Average score" value={percent(c.averageScore)} tone="good" hint={`${c.evaluated} final evaluations`} />
        <StatCard label="Highest" value={percent(c.highestScore)} />
        <StatCard label="Lowest" value={percent(c.lowestScore)} />
        <StatCard label="Completion rate" value={percent(c.completionRate)} hint={`${c.toEvaluate} people to evaluate`} />
      </div>
      <h2 className="section-title">Companies ranked by average score</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Average</th>
              <th className="num">Highest</th>
              <th className="num">Lowest</th>
              <th className="num">Evaluated</th>
              <th className="num">Completion</th>
            </tr>
          </thead>
          <tbody>
            {data.companies.map((row) => (
              <tr key={row.company.id}>
                <td>{row.rank ?? '—'}</td>
                <td className="strong">{row.company.name}</td>
                <td>{row.averageScore === null ? <span className="muted">No results yet</span> : <ProgressBar value={row.averageScore} />}</td>
                <td className="num">{percent(row.highestScore)}</td>
                <td className="num">{percent(row.lowestScore)}</td>
                <td className="num">{row.evaluated}</td>
                <td className="num">{percent(row.completionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ManagerPerformance({ periodId }) {
  const { data, error, loading } = useReport('/reports/managers', periodId);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  if (data.managers.length === 0) return <EmptyState>No companies have a Manager.</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Manager</th>
            <th className="num">Submitted</th>
            <th className="num">On time</th>
            <th className="num">Returned</th>
            <th className="num">Team average</th>
            <th>Own evaluation</th>
          </tr>
        </thead>
        <tbody>
          {data.managers.map((m) => (
            <tr key={m.manager.userId}>
              <td>
                <div className="strong">{fullName(m.manager)}</div>
                <div className="muted small">{m.company.name}</div>
              </td>
              <td className="num">
                {m.submitted} / {m.toEvaluate}
                <div className="muted small">{percent(m.submissionRate)}</div>
              </td>
              <td className="num">
                {m.submittedOnTime}
                <div className="muted small">{percent(m.onTimeRate)}</div>
              </td>
              <td className="num">{m.returnedForCorrection}</td>
              <td className="num strong">{percent(m.teamAverageScore)}</td>
              <td>
                {m.ownEvaluation ? (
                  <Link to={`/evaluations/${m.ownEvaluation.id}`}>
                    {m.ownEvaluation.overallScore !== null ? percent(m.ownEvaluation.overallScore) : m.ownEvaluation.status.toLowerCase()}
                  </Link>
                ) : (
                  <Badge>Not started</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A small horizontal bar with the number next to it.
function ProgressBar({ value }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return (
    <div className="progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="progress-value">{value}%</span>
    </div>
  );
}
