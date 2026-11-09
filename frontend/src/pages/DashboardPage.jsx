// The dashboard: one summary per role, from GET /api/reports/dashboard.

import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorAlert, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import { useApi } from '../hooks/useApi.js';

const percent = (value) => (value === null || value === undefined ? '—' : `${value}%`);

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/reports/dashboard');

  if (loading) return <Spinner label="Loading the dashboard…" />;
  if (error) return <ErrorAlert error={error} />;

  const greeting = user.firstName ? `Welcome, ${user.firstName}` : 'Welcome';
  const periodText = data.period ? `Period: ${data.period.name} (${data.period.status.toLowerCase()})` : 'No evaluation period yet';

  return (
    <div className="page">
      <PageHeader title={greeting} subtitle={periodText} />
      {data.role === 'HOLDING' && <HoldingDashboard d={data} />}
      {data.role === 'MANAGER' && <ManagerDashboard d={data} />}
      {data.role === 'EMPLOYEE' && <EmployeeDashboard d={data} />}
    </div>
  );
}

function HoldingDashboard({ d }) {
  const e = d.employeeEvaluations;
  return (
    <>
      <h2 className="section-title">Organization</h2>
      <div className="stat-grid">
        <StatCard label="Active companies" value={d.organization.activeCompanies} />
        <StatCard label="Managers" value={d.organization.managers} />
        <StatCard label="Employees" value={d.organization.employees} />
      </div>
      {d.period && (
        <>
          <h2 className="section-title">This period</h2>
          <div className="stat-grid">
            <StatCard label="Waiting for approval" value={d.waitingForApproval} tone={d.waitingForApproval > 0 ? 'warn' : 'default'} hint={d.canApproveEvaluations ? 'You can approve these' : 'Approval needs permission'} />
            <StatCard label="Waiting for publication" value={d.waitingForPublication} />
            <StatCard label="Completion rate" value={percent(e.completionRate)} tone="good" hint="Employee evaluations approved or published" />
            <StatCard label="Not started" value={e.notStarted} />
            <StatCard label="Self-assessments submitted" value={d.selfAssessmentsSubmitted} />
          </div>
          <h2 className="section-title">Employee evaluations by status</h2>
          <StatusBar counts={e} />
          <h2 className="section-title">Manager evaluations by status</h2>
          <StatusBar counts={d.managerEvaluations} />
        </>
      )}
    </>
  );
}

function ManagerDashboard({ d }) {
  const t = d.teamEvaluations;
  return (
    <>
      <h2 className="section-title">{d.company.name}</h2>
      <div className="stat-grid">
        <StatCard label="Team members" value={d.team.size} />
        <StatCard label="Team goals in progress" value={d.teamGoals.byStatus.IN_PROGRESS} hint={`Average progress ${percent(d.teamGoals.averageProgress)}`} />
        <StatCard label="Team goals completed" value={d.teamGoals.byStatus.COMPLETED} tone="good" />
      </div>
      {d.period && (
        <>
          <h2 className="section-title">Evaluations this period</h2>
          <div className="stat-grid">
            <StatCard label="Not started" value={t.notStarted} tone={t.notStarted > 0 ? 'warn' : 'default'} />
            <StatCard label="Drafts" value={t.DRAFT} />
            <StatCard label="Returned to fix" value={t.toFix} tone={t.toFix > 0 ? 'bad' : 'default'} />
            <StatCard label="Waiting for approval" value={t.SUBMITTED} />
            <StatCard label="Completion rate" value={percent(t.completionRate)} tone="good" />
            <StatCard label="Self-assessments submitted" value={d.selfAssessmentsSubmitted} />
          </div>
          <h2 className="section-title">My own evaluation</h2>
          <div className="stat-grid">
            <StatCard
              label="My result"
              value={d.myEvaluation ? percent(d.myEvaluation.overallScore) : 'Not published yet'}
              hint={d.myEvaluation && !d.myEvaluation.acknowledged ? 'Please read and acknowledge it' : undefined}
            />
          </div>
        </>
      )}
    </>
  );
}

function EmployeeDashboard({ d }) {
  const g = d.goals.byStatus;
  const selfLabels = { NOT_STARTED: 'Not started', DRAFT: 'Draft saved', SUBMITTED: 'Submitted' };
  return (
    <>
      <h2 className="section-title">My goals</h2>
      <div className="stat-grid">
        <StatCard label="In progress" value={g.IN_PROGRESS} />
        <StatCard label="Not started" value={g.NOT_STARTED} />
        <StatCard label="Completed" value={g.COMPLETED} tone="good" />
        <StatCard label="Average progress" value={percent(d.goals.averageProgress)} />
      </div>
      <h2 className="section-title">My evaluation</h2>
      <div className="stat-grid">
        {d.period && <StatCard label="My self-assessment" value={selfLabels[d.selfAssessment]} tone={d.selfAssessment === 'SUBMITTED' ? 'good' : 'warn'} />}
        <StatCard
          label="Latest result"
          value={d.latestEvaluation ? percent(d.latestEvaluation.overallScore) : 'None published yet'}
          hint={d.latestEvaluation ? d.latestEvaluation.period.name : undefined}
        />
        <StatCard label="Published evaluations" value={d.publishedEvaluations} />
      </div>
    </>
  );
}

// A horizontal bar showing how many evaluations are in each status.
const STATUS_ORDER = [
  ['DRAFT', 'Draft'],
  ['RETURNED', 'Returned'],
  ['SUBMITTED', 'Submitted'],
  ['APPROVED', 'Approved'],
  ['PUBLISHED', 'Published'],
];

function StatusBar({ counts }) {
  const total = STATUS_ORDER.reduce((sum, [key]) => sum + (counts[key] ?? 0), 0);
  if (total === 0) return <p className="muted">No evaluations started yet.</p>;
  return (
    <div className="status-bar-wrap">
      <div className="status-bar" aria-hidden="true">
        {STATUS_ORDER.map(([key]) =>
          counts[key] > 0 ? <span key={key} className={`seg seg-${key}`} style={{ flexGrow: counts[key] }} /> : null,
        )}
      </div>
      <ul className="status-legend">
        {STATUS_ORDER.map(([key, label]) => (
          <li key={key}>
            <span className={`dot seg-${key}`} /> {label}: <strong>{counts[key] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
