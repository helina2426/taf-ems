// Labels and small helpers for plans and KPIs (version 2). Plain functions, so they can be unit-tested.

export const PLAN_STATUS = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Waiting for approval', tone: 'info' },
  RETURNED: { label: 'Returned to fix', tone: 'warn' },
  ACTIVE: { label: 'Active', tone: 'good' },
};

export const PERSPECTIVES = [
  { value: 'FINANCIAL', label: 'Financial', help: 'Money: revenue, costs, profit.' },
  { value: 'CUSTOMER', label: 'Customer', help: 'What customers get: on-time deliveries, complaints.' },
  { value: 'INTERNAL_PROCESS', label: 'Internal process', help: 'How the work is done: deliveries, fuel loss, safety.' },
  { value: 'LEARNING_GROWTH', label: 'Learning & growth', help: 'People and skills: training, certifications.' },
];

export const DIRECTIONS = [
  { value: 'HIGHER_IS_BETTER', label: 'Higher is better', short: '↑ higher is better', help: 'Sales, deliveries, revenue.' },
  { value: 'LOWER_IS_BETTER', label: 'Lower is better', short: '↓ lower is better', help: 'Costs, fuel loss, complaints.' },
  { value: 'EXACT', label: 'Exact is best', short: '= exact is best', help: 'A stock level that should equal the target.' },
  { value: 'ZERO', label: 'Zero is best', short: '0 zero is best', help: 'Accidents, defects. The target is 0.' },
];

export const AGGREGATIONS = [
  { value: 'SUM', label: 'Add the months up', help: 'Things you count: 100 deliveries a month = 1,200 a year.' },
  { value: 'AVERAGE', label: 'Average of the months', help: 'Rates and percentages: 95% on time every month = 95% for the year.' },
  { value: 'LAST', label: 'Last month counts', help: 'A level at a moment: the stock at the end of the year.' },
];

const byValue = (list) => Object.fromEntries(list.map((item) => [item.value, item]));
export const PERSPECTIVE = byValue(PERSPECTIVES);
export const DIRECTION = byValue(DIRECTIONS);
export const AGGREGATION = byValue(AGGREGATIONS);

// "Holding plan", "Company plan · Alpha Energy", "Plan of Dawit Bekele"
export function planTitle(plan) {
  if (plan.level === 'HOLDING') return 'Holding plan';
  if (plan.level === 'COMPANY') return `Company plan · ${plan.company?.name ?? ''}`;
  return `Plan of ${[plan.employee?.firstName, plan.employee?.lastName].filter(Boolean).join(' ')}`;
}

// 1200 → "1,200"   95.5 → "95.5"
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Live check of 12 monthly targets typed in a form (the server checks again).
// Returns { total, average, message } — message is null when the months fit the year target.
export function checkMonths(targets, yearTarget, aggregation) {
  const numbers = targets.map(Number);
  const total = Math.round(numbers.reduce((sum, t) => sum + t, 0) * 100) / 100;
  const average = Math.round((total / 12) * 100) / 100;
  let message = null;
  if (numbers.some((t) => !Number.isFinite(t) || t < 0)) message = 'Every month needs a number of 0 or more.';
  else if (aggregation === 'SUM' && Math.abs(total - yearTarget) > 0.01) message = `The months add up to ${formatNumber(total)}; they must add up to ${formatNumber(yearTarget)}.`;
  else if (aggregation === 'AVERAGE' && Math.abs(average - yearTarget) > 0.01) message = `The average is ${formatNumber(average)}; it must be ${formatNumber(yearTarget)}.`;
  else if (aggregation === 'LAST' && Math.abs(numbers[11] - yearTarget) > 0.01) message = `The 12th month must be ${formatNumber(yearTarget)}.`;
  return { total, average, message };
}

// The plan year to show first: the active one that contains today, otherwise the newest.
export function defaultPlanYearId(planYears, today = new Date().toLocaleDateString('en-CA')) {
  const current = planYears.find((y) => y.status === 'ACTIVE' && y.startDate <= today && today <= y.endDate);
  return (current ?? planYears.find((y) => y.status === 'ACTIVE') ?? planYears[0])?.id ?? '';
}
