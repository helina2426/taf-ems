// The "Plan year" tab of the reports (version 2, Module 19), from GET /api/reports/plan-year.
//
//   • KPI progress of each company plan: year to date and per quarter, with traffic lights
//   • the people: on track / at risk / off track, and who has no plan yet
//   • numbers waiting for confirmation, and the rating distribution of published evaluations
// Holding users see every company (and can pick one); Managers see their own company only.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { Badge, EmptyState, ErrorAlert, Spinner, StatCard } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatNumber } from '../../utils/plans.js';
import { quarterLabel } from '../../utils/reports.js';
import { LightCounts, LightDot, PeopleList, RatingBars } from './V2Parts.jsx';

export function PlanYearReport() {
  const { user } = useAuth();
  const [planYearId, setPlanYearId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const params = { ...(planYearId && { planYearId }), ...(companyId && { companyId }) };
  const { data, error, loading } = useApi('/reports/plan-year', params);
  // The full company list for the filter comes from the first answer (all companies).
  const [allCompanies, setAllCompanies] = useState([]);
  useEffect(() => {
    if (data?.companies && !companyId) setAllCompanies(data.companies.map((c) => ({ id: c.id, name: c.name })));
  }, [data, companyId]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!data.planYear) return <EmptyState>There is no plan year yet. Create one under "Plan years".</EmptyState>;

  const people = data.employees.length;
  const active = data.employees.filter((p) => p.plan?.status === 'ACTIVE').length;
  return (
    <>
      <div className="toolbar">
        <select value={planYearId || data.planYear.id} onChange={(e) => setPlanYearId(e.target.value)} aria-label="Plan year">
          {data.planYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name} ({y.status.toLowerCase()})
            </option>
          ))}
        </select>
        {user.role === 'HOLDING' && (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Company">
            <option value="">All companies</option>
            {allCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="muted small">Only confirmed monthly numbers count. Green = 100% of the target so far or more, yellow = 85–99%, red = below 85%.</p>

      <div className="stat-grid">
        <StatCard label="Employees with an active plan" value={`${active} / ${people}`} />
        <StatCard label="Without a plan" value={data.withoutPlan.length} tone={data.withoutPlan.length > 0 ? 'warn' : 'default'} />
        <StatCard label="On track" value={data.lists.onTrack.length} tone="good" hint="Every KPI green" />
        <StatCard label="At risk" value={data.lists.atRisk.length} tone={data.lists.atRisk.length ? 'warn' : 'default'} hint="Worst KPI yellow" />
        <StatCard label="Off track" value={data.lists.offTrack.length} tone={data.lists.offTrack.length ? 'bad' : 'default'} hint="At least one red KPI" />
        <StatCard label="Numbers waiting" value={data.waitingForConfirmation} tone={data.waitingForConfirmation ? 'warn' : 'default'} hint="Entered, not confirmed yet" />
      </div>

      <h2 className="section-title">Company plans</h2>
      {data.companies.map((c) => (
        <CompanyBlock key={c.id} company={c} quarters={data.quarters} />
      ))}

      <h2 className="section-title">People</h2>
      <div className="people-grid">
        <div className="panel">
          <h3>Off track ({data.lists.offTrack.length})</h3>
          <PeopleList people={data.lists.offTrack} empty="Nobody." showCompany />
        </div>
        <div className="panel">
          <h3>At risk ({data.lists.atRisk.length})</h3>
          <PeopleList people={data.lists.atRisk} empty="Nobody." showCompany />
        </div>
        <div className="panel">
          <h3>On track ({data.lists.onTrack.length})</h3>
          <PeopleList people={data.lists.onTrack} empty="Nobody yet." showCompany />
        </div>
        <div className="panel">
          <h3>No plan yet ({data.withoutPlan.length})</h3>
          <PeopleList people={data.withoutPlan} empty="Everybody has a plan." showCompany />
          {data.lists.noNumbersYet.length > 0 && <p className="muted small">{data.lists.noNumbersYet.length} active plan(s) have no confirmed numbers yet.</p>}
        </div>
      </div>

      <h2 className="section-title">Ratings ({data.planYear.name})</h2>
      <div className="people-grid">
        <div className="panel">
          <h3>Mid-year reviews</h3>
          <RatingBars distribution={data.ratings.midYear} />
        </div>
        <div className="panel">
          <h3>Annual evaluations</h3>
          <RatingBars distribution={data.ratings.annual} />
        </div>
      </div>
      {data.companies.length > 1 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Exceeds</th>
                <th className="num">Successfully meets</th>
                <th className="num">Partially meets</th>
                <th className="num">Does not meet</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="num">{c.ratings.EXCEEDS}</td>
                  <td className="num">{c.ratings.SUCCESSFULLY_MEETS}</td>
                  <td className="num">{c.ratings.PARTIALLY_MEETS}</td>
                  <td className="num">{c.ratings.DOES_NOT_MEET}</td>
                  <td className="num strong">{c.ratings.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// One company: its plan's KPIs (year to date and quarters) and its people in numbers.
function CompanyBlock({ company, quarters }) {
  const plan = company.companyPlan;
  const e = company.employees;
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{company.name}</h3>
          <div className="muted small">
            {e.activePlans} of {e.total} employee plan(s) active · {e.withoutPlan} without a plan · {e.offTrack} off track · {e.atRisk} at risk
            {company.waitingForConfirmation > 0 && ` · ${company.waitingForConfirmation} number(s) waiting`}
          </div>
        </div>
        {plan?.status === 'ACTIVE' && (
          <Link to={`/plans/${plan.id}`} className="small">
            Open the plan →
          </Link>
        )}
        {plan ? <LightCounts lights={plan.status === 'ACTIVE' ? plan.lights : null} /> : <Badge tone="warn">No company plan</Badge>}
      </div>
      {plan && plan.status !== 'ACTIVE' && (
        <p className="muted small">
          The <Link to={`/plans/${plan.id}`}>company plan</Link> is not active yet ({plan.status.toLowerCase()}).
        </p>
      )}
      {plan?.status === 'ACTIVE' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>KPI</th>
                <th className="num">Year to date</th>
                {quarters.map((q) => (
                  <th key={q.id} className="num">
                    {quarterLabel(q.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.kpis.map((k) => (
                <tr key={k.id}>
                  <td>
                    {k.name} <span className="muted small">({k.weight} pts)</span>
                    <div className="muted small">
                      {k.yearToDate.monthsKnown > 0 ? `So far ${formatNumber(k.yearToDate.actual)} ${k.unit} (target so far ${formatNumber(k.yearToDate.targetSoFar)})` : 'No confirmed numbers yet'} · year target {formatNumber(k.yearTarget)}
                    </div>
                  </td>
                  <td className="num nowrap">
                    <LightDot light={k.yearToDate.light} /> {k.yearToDate.achievement !== null && `${k.yearToDate.achievement}%`}
                  </td>
                  {k.quarters.map((q) => (
                    <td key={q.periodId} className="num nowrap">
                      <LightDot light={q.light} /> {q.achievement !== null && `${q.achievement}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
