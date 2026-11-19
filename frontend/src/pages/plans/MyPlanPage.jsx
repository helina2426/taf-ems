// "My plan" for employees: their plan of the current plan year, once the Manager has shared it.
// They can read every KPI and its monthly targets, and acknowledge the plan.

import { useMemo, useState } from 'react';
import { EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { defaultPlanYearId } from '../../utils/plans.js';
import { PlanView } from './PlanDetailPage.jsx';

export function MyPlanPage() {
  const years = useApi('/plan-years');
  const yearList = useMemo(() => years.data?.items ?? [], [years.data]);
  const [chosen, setChosen] = useState('');
  const planYearId = chosen || defaultPlanYearId(yearList);
  const plans = useApi(planYearId ? '/plans' : null, { planYearId });
  const planId = plans.data?.items[0]?.id;
  const plan = useApi(planId ? `/plans/${planId}` : null);

  const yearSelect = yearList.length > 1 && (
    <select value={planYearId} onChange={(e) => setChosen(e.target.value)} aria-label="Plan year">
      {yearList.map((y) => (
        <option key={y.id} value={y.id}>
          {y.name}
        </option>
      ))}
    </select>
  );

  if (years.loading || plans.loading || plan.loading) return <Spinner />;
  const error = years.error || plans.error || plan.error;
  if (error) return <ErrorAlert error={error} />;

  if (!planId) {
    return (
      <div className="page">
        <PageHeader title="My plan" actions={yearSelect} />
        <EmptyState>Your Manager has not shared your plan for this year yet.</EmptyState>
      </div>
    );
  }
  // Right after the plan id is known, its details are not loaded yet.
  if (!plan.data) return <Spinner />;
  return (
    <>
      {yearSelect && <div className="page-top-select">{yearSelect}</div>}
      <PlanView plan={plan.data.plan} reload={plan.reload} />
    </>
  );
}
