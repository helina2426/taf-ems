// "Plans": the overview of one plan year, in the hierarchy order Holding → Manager → Employee.
//
//   Holding users: the Holding plan, then every company plan (and how many employee plans are active).
//   Managers:      the Holding plan (read only), their company plan, then one row per team member.
// Each row opens the plan (PlanDetailPage). Employees use "My plan" instead.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fullName } from '../../utils/format.js';
import { PLAN_STATUS, defaultPlanYearId } from '../../utils/plans.js';

export function PlansPage() {
  const { user } = useAuth();
  const years = useApi('/plan-years');
  const yearList = useMemo(() => years.data?.items ?? [], [years.data]);
  const [chosen, setChosen] = useState('');
  const planYearId = chosen || defaultPlanYearId(yearList);
  const planYear = yearList.find((y) => y.id === planYearId);

  return (
    <div className="page">
      <PageHeader
        title="Plans"
        subtitle="Every KPI is linked to the level above: Holding → company (Manager) → employee."
        actions={
          yearList.length > 0 && (
            <select value={planYearId} onChange={(e) => setChosen(e.target.value)} aria-label="Plan year">
              {yearList.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.status.toLowerCase()})
                </option>
              ))}
            </select>
          )
        }
      />
      {years.loading && !years.data && <Spinner />}
      <ErrorAlert error={years.error} />
      {years.data && yearList.length === 0 && <EmptyState>No plan year yet. {user.role === 'HOLDING' ? 'Create one on the Plan years page.' : 'Ask the Holding to create one.'}</EmptyState>}
      {planYear && <Overview key={planYear.id} planYear={planYear} user={user} />}
    </div>
  );
}

function Overview({ planYear, user }) {
  const { data, error, loading, reload } = useApi('/plans', { planYearId: planYear.id });
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const plans = data.items;
  const holdingPlan = plans.find((p) => p.level === 'HOLDING');

  return (
    <>
      {planYear.status === 'CLOSED' && <Alert type="info">This plan year is closed: plans can be read but not changed.</Alert>}
      <h2 className="section-title">1. Holding plan</h2>
      <PlanCard
        plan={holdingPlan}
        emptyText={user.role === 'HOLDING' ? 'The Holding plan has not been written yet. It comes first: company plans link to it.' : 'The Holding has not written its plan yet.'}
        create={user.role === 'HOLDING' && planYear.status !== 'CLOSED' ? { planYearId: planYear.id, level: 'HOLDING' } : null}
        onCreated={reload}
      />
      {user.role === 'HOLDING' ? <CompaniesTable plans={plans} planYear={planYear} /> : <ManagerSection planYear={planYear} plans={plans} onCreated={reload} />}
    </>
  );
}

// One plan in a box: its status and an "Open" button — or a "Create" button when it does not exist.
function PlanCard({ plan, title, emptyText, create, onCreated }) {
  const navigate = useNavigate();
  const { run, busy, error } = useSubmit();
  if (!plan) {
    return (
      <div className="panel">
        {title && <h3>{title}</h3>}
        <p className="muted">{emptyText}</p>
        <ErrorAlert error={error} />
        {create && (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => run(() => api.post('/plans', create), (data) => { onCreated?.(); navigate(`/plans/${data.plan.id}`); })}
          >
            {busy ? 'Creating…' : 'Create the plan'}
          </button>
        )}
      </div>
    );
  }
  const status = PLAN_STATUS[plan.status];
  return (
    <div className="panel plan-card">
      <div>
        {title && <h3>{title}</h3>}
        <Badge tone={status.tone}>{status.label}</Badge>{' '}
        <span className="muted small">
          {plan.kpiCount} KPIs{plan.level !== 'HOLDING' && ` · ${plan.weightTotal} points`}
        </span>
      </div>
      <Link className="btn btn-ghost" to={`/plans/${plan.id}`}>
        Open
      </Link>
    </div>
  );
}

function CompaniesTable({ plans, planYear }) {
  const companies = useApi('/companies', { pageSize: 100, isActive: 'true' });
  if (companies.loading && !companies.data) return <Spinner />;
  const list = companies.data?.items ?? [];
  const waiting = plans.filter((p) => p.level === 'COMPANY' && p.status === 'SUBMITTED').length;

  return (
    <>
      <h2 className="section-title">2. Company plans (one per Manager)</h2>
      {waiting > 0 && <Alert type="info">{waiting} company plan(s) waiting for your approval.</Alert>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Company plan</th>
              <th className="num">KPIs</th>
              <th className="num">Points</th>
              <th className="num">Employee plans active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((company) => {
              const plan = plans.find((p) => p.level === 'COMPANY' && p.company?.id === company.id);
              const people = plans.filter((p) => p.level === 'INDIVIDUAL' && p.company?.id === company.id);
              return (
                <tr key={company.id}>
                  <td className="strong">{company.name}</td>
                  <td>
                    {plan ? <Badge tone={PLAN_STATUS[plan.status].tone}>{PLAN_STATUS[plan.status].label}</Badge> : <span className="muted small">Not written yet</span>}
                    {plan?.waitingForConfirmation > 0 && <div className="small">{plan.waitingForConfirmation} number(s) to confirm</div>}
                  </td>
                  <td className="num">{plan?.kpiCount ?? '—'}</td>
                  <td className="num">{plan ? `${plan.weightTotal} / ${planYear.rules.managerResultsShare}` : '—'}</td>
                  <td className="num">
                    {people.filter((p) => p.status === 'ACTIVE').length} of {people.length}
                  </td>
                  <td className="row-actions">
                    {plan && (
                      <Link className="btn btn-ghost btn-small" to={`/plans/${plan.id}`}>
                        {plan.status === 'SUBMITTED' ? 'Review' : 'Open'}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EmployeePlansList plans={plans.filter((p) => p.level === 'INDIVIDUAL')} />
    </>
  );
}

function EmployeePlansList({ plans }) {
  if (plans.length === 0) return null;
  return (
    <>
      <h2 className="section-title">3. Employee plans</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Company</th>
              <th>Status</th>
              <th>Acknowledged</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="strong">{fullName(p.employee)}</td>
                <td className="small">{p.company?.name}</td>
                <td>
                  <Badge tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Badge>
                </td>
                <td className="small">{p.acknowledgedAt ? 'Yes' : '—'}</td>
                <td className="row-actions">
                  <Link className="btn btn-ghost btn-small" to={`/plans/${p.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ManagerSection({ planYear, plans, onCreated }) {
  const team = useApi('/employees', { pageSize: 100 });
  const companyPlan = plans.find((p) => p.level === 'COMPANY');
  const open = planYear.status !== 'CLOSED';
  const navigate = useNavigate();
  const { run, busy, error } = useSubmit();
  const members = (team.data?.items ?? []).filter((e) => ['ACTIVE', 'ON_LEAVE'].includes(e.employmentStatus));

  return (
    <>
      <h2 className="section-title">2. My company plan</h2>
      <PlanCard
        plan={companyPlan}
        emptyText="Your company plan is also your own plan: the Head evaluates you on it. Link each KPI to a Holding KPI."
        create={open ? { planYearId: planYear.id, level: 'COMPANY' } : null}
        onCreated={onCreated}
      />

      <h2 className="section-title">3. My team's plans</h2>
      {companyPlan?.status !== 'ACTIVE' && (
        <Alert type="info">You can start writing your team's plans now. They can be activated once your company plan is approved.</Alert>
      )}
      <ErrorAlert error={error || team.error} />
      {team.loading && !team.data && <Spinner />}
      {team.data && members.length === 0 && <EmptyState>No employees in your team yet.</EmptyState>}
      {members.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Plan</th>
                <th className="num">KPIs</th>
                <th className="num">Points</th>
                <th>Acknowledged</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((person) => {
                const plan = plans.find((p) => p.level === 'INDIVIDUAL' && p.employee?.id === person.id);
                return (
                  <tr key={person.id}>
                    <td>
                      <div className="strong">{fullName(person)}</div>
                      <div className="muted small">{person.jobTitle ?? ''}</div>
                    </td>
                    <td>
                      {plan ? <Badge tone={PLAN_STATUS[plan.status].tone}>{PLAN_STATUS[plan.status].label}</Badge> : <span className="muted small">No plan yet</span>}
                      {plan?.waitingForConfirmation > 0 && <div className="small">{plan.waitingForConfirmation} number(s) to confirm</div>}
                    </td>
                    <td className="num">{plan?.kpiCount ?? '—'}</td>
                    <td className="num">{plan ? `${plan.weightTotal} / ${planYear.rules.employeeResultsShare}` : '—'}</td>
                    <td className="small">{plan?.acknowledgedAt ? 'Yes' : '—'}</td>
                    <td className="row-actions">
                      {plan ? (
                        <Link className="btn btn-ghost btn-small" to={`/plans/${plan.id}`}>
                          Open
                        </Link>
                      ) : (
                        open && (
                          <button
                            className="btn btn-ghost btn-small"
                            disabled={busy}
                            onClick={() =>
                              run(() => api.post('/plans', { planYearId: planYear.id, level: 'INDIVIDUAL', employeeId: person.id }), (data) => navigate(`/plans/${data.plan.id}`))
                            }
                          >
                            Create plan
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
