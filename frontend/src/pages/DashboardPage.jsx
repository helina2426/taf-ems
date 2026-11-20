// The dashboard: one summary per role, from GET /api/reports/dashboard.
//
// Version 2 (Module 19): the plan year comes first (data.v2) — KPI lights, what is waiting,
// people on track or at risk, ratings. The version 1 parts (periods, goals) follow when they exist.

import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { Badge, ErrorAlert, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { KIND_LABEL, RATING_TONE } from '../utils/evaluations.js';
import { percent } from '../utils/format.js';
import { formatNumber } from '../utils/plans.js';
import { LIGHT } from '../utils/progress.js';
import { lightsText, resultText } from '../utils/reports.js';
import { LightCounts, LightDot, PeopleList, RatingBars } from './reports/V2Parts.jsx';


export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/reports/dashboard');

  if (loading) return <Spinner label="Loading the dashboard…" />;
  if (error) return <ErrorAlert error={error} />;

  const greeting = user.firstName ? `Welcome, ${user.firstName}` : 'Welcome';
  const periodText = data.v2?.planYear
    ? `Plan year ${data.v2.planYear.name} (${data.v2.planYear.status.toLowerCase()})`
    : data.period
      ? `Period: ${data.period.name} (${data.period.status.toLowerCase()})`
      : 'No plan year yet';

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
  const v = d.v2;
  return (
    <>
      {v && (
        <>
          <h2 className="section-title">Waiting for the Holding</h2>
          <div className="stat-grid">
            <StatLink to="/plans" label="Company plans to approve" value={v.companyPlansWaiting} />
            <StatLink to="/target-changes" label="Target changes to decide" value={v.targetChangesWaiting} />
            <StatLink to="/appeals" label="Appeals to decide" value={v.appealsWaiting} />
            <StatLink to="/plans" label="Company numbers to confirm" value={v.companyNumbersWaiting} hint="Monthly numbers of the company plans" />
          </div>
          <h2 className="section-title">The plan year so far</h2>
          <PeopleCards people={v.people} />
          <div className="people-grid">
            <div className="panel">
              <h3>Company plans</h3>
              <ul className="people-list">
                {v.companies.map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    {c.planStatus === 'ACTIVE' ? <LightCounts lights={c.lights} /> : <Badge tone="warn">{c.planStatus ? c.planStatus.toLowerCase() : 'no plan'}</Badge>}
                  </li>
                ))}
              </ul>
              <Link to="/reports" className="small">
                The full plan-year report →
              </Link>
            </div>
            <div className="panel">
              <h3>Ratings</h3>
              <RatingBars distribution={v.ratings} />
            </div>
          </div>
        </>
      )}
      <h2 className="section-title">Organization</h2>
      <div className="stat-grid">
        <StatCard label="Active companies" value={d.organization.activeCompanies} />
        <StatCard label="Managers" value={d.organization.managers} />
        <StatCard label="Employees" value={d.organization.employees} />
      </div>
      {d.period && (
        <>
          <h2 className="section-title">Evaluations: {d.period.name}</h2>
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
  const v = d.v2;
  const goals = d.teamGoals.byStatus;
  return (
    <>
      <h2 className="section-title">{d.company.name}</h2>
      {v && (
        <>
          <div className="stat-grid">
            <StatCard label="Company plan" value={v.companyPlan ? (v.companyPlan.status === 'ACTIVE' ? lightsText(v.companyPlan.lights) : v.companyPlan.status.toLowerCase()) : 'Not written yet'} tone={v.companyPlan?.lights?.RED ? 'bad' : 'default'} />
            <StatLink to="/plans" label="Numbers to confirm" value={v.waitingForConfirmation} hint="Entered by your team" />
            <StatLink to="/target-changes" label="Target changes waiting" value={v.targetChangesWaiting} hint="Waiting for the Head" />
            <StatLink to="/plans" label="Employee plans not active yet" value={v.planDrafts} />
            {v.checkIns && <StatLink to="/check-ins" label="Check-ins this week" value={`${v.checkIns.written} / ${v.checkIns.team}`} hint={`Week of ${v.checkIns.weekStart}`} />}
          </div>
          <h2 className="section-title">My team this plan year</h2>
          <PeopleCards people={v.people} />
          <div className="people-grid">
            <div className="panel">
              <h3>Talk to them first</h3>
              <PeopleList people={v.watchList} empty="Nobody is off track or at risk." />
              <Link to="/reports" className="small">
                The full plan-year report →
              </Link>
            </div>
            <div className="panel">
              <h3>Ratings in my company</h3>
              <RatingBars distribution={v.ratings} />
              <div className="small">
                My latest result:{' '}
                {v.myLatestEvaluation ? (
                  <Link to="/my-evaluations">
                    {resultText(v.myLatestEvaluation)} ({KIND_LABEL[v.myLatestEvaluation.kind]?.toLowerCase()})
                  </Link>
                ) : (
                  <span className="muted">none published yet</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <div className="stat-grid">
        <StatCard label="Team members" value={d.team.size} />
        {goals.IN_PROGRESS + goals.COMPLETED + goals.NOT_STARTED > 0 && (
          <>
            <StatCard label="Team goals in progress" value={goals.IN_PROGRESS} hint={`Average progress ${percent(d.teamGoals.averageProgress)}`} />
            <StatCard label="Team goals completed" value={goals.COMPLETED} tone="good" />
          </>
        )}
      </div>
      {d.period && (
        <>
          <h2 className="section-title">Evaluations: {d.period.name}</h2>
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
              value={d.myEvaluation ? resultText(d.myEvaluation) : 'Not published yet'}
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
  const hasGoals = g.IN_PROGRESS + g.NOT_STARTED + g.COMPLETED > 0;
  const selfLabels = { NOT_STARTED: 'Not started', DRAFT: 'Draft saved', SUBMITTED: 'Submitted' };
  const latest = d.latestEvaluation;
  return (
    <>
      {d.v2 && <MyPlan v2={d.v2} />}
      {(hasGoals || !d.v2) && (
        <>
          <h2 className="section-title">My goals</h2>
          <div className="stat-grid">
            <StatCard label="In progress" value={g.IN_PROGRESS} />
            <StatCard label="Not started" value={g.NOT_STARTED} />
            <StatCard label="Completed" value={g.COMPLETED} tone="good" />
            <StatCard label="Average progress" value={percent(d.goals.averageProgress)} />
          </div>
        </>
      )}
      <h2 className="section-title">My evaluation</h2>
      <div className="stat-grid">
        {d.period && <StatCard label="My self-assessment" value={selfLabels[d.selfAssessment]} tone={d.selfAssessment === 'SUBMITTED' ? 'good' : 'warn'} />}
        <StatCard
          label="Latest result"
          value={latest ? resultText(latest) : 'None published yet'}
          tone={latest?.rating ? RATING_TONE[latest.rating] : 'default'}
          hint={latest ? `${latest.kind ? KIND_LABEL[latest.kind] + ' · ' : ''}${latest.period.name}${latest.acknowledged ? '' : ' · please read and acknowledge it'}` : undefined}
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

// ---------- Version 2 pieces (Module 19) ----------

// A stat card that opens the page where the work is done.
function StatLink({ to, label, value, hint }) {
  return (
    <Link to={to} className="stat-link">
      <StatCard label={label} value={value} hint={hint} tone={typeof value === 'number' && value > 0 ? 'warn' : 'default'} />
    </Link>
  );
}

// People by the worst light of their plan.
function PeopleCards({ people }) {
  return (
    <div className="stat-grid">
      <StatCard label="Active plans" value={`${people.activePlans} / ${people.total}`} hint="Employees with an active plan" />
      <StatCard label="No plan yet" value={people.withoutPlan} tone={people.withoutPlan ? 'warn' : 'default'} />
      <StatCard label="On track" value={people.onTrack} tone="good" hint="Every KPI green" />
      <StatCard label="At risk" value={people.atRisk} tone={people.atRisk ? 'warn' : 'default'} hint="Worst KPI yellow" />
      <StatCard label="Off track" value={people.offTrack} tone={people.offTrack ? 'bad' : 'default'} hint="At least one red KPI" />
    </div>
  );
}

// The employee's own plan: one line per KPI with its light, year to date.
function MyPlan({ v2 }) {
  const plan = v2.myPlan;
  return (
    <>
      <h2 className="section-title">My plan — {v2.planYear.name}</h2>
      {!plan ? (
        <p className="muted">Your plan for {v2.planYear.name} is not ready yet. Your Manager will share it with you.</p>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <div className="small">{lightsText(plan.lights)}</div>
            <Link to="/my-plan" className="small">
              Open my plan →
            </Link>
          </div>
          {!plan.acknowledged && <p className="small">Please read your plan and acknowledge it.</p>}
          <ul className="people-list">
            {plan.kpis.map((k) => (
              <li key={k.id}>
                <span>
                  {k.name} <span className="muted small">({k.weight} pts)</span>
                  <div className="muted small">
                    {k.monthsKnown > 0 ? `So far ${formatNumber(k.actual)} ${k.unit} (target so far ${formatNumber(k.targetSoFar)}) · ${k.monthsKnown} month(s) confirmed` : 'No confirmed numbers yet'}
                  </div>
                </span>
                <span className="nowrap">
                  <LightDot light={k.light} /> {k.light ? `${k.achievement}% · ${LIGHT[k.light].label}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
