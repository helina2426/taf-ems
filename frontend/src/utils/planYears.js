// Labels and small helpers for plan years (version 2). Plain functions, so they can be unit-tested.

export const CALENDAR_LABEL = { ETHIOPIAN: 'Ethiopian (EFY)', GREGORIAN: 'Gregorian (GC)' };

export const PLAN_YEAR_STATUS = {
  PLANNING: { label: 'Planning', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'good' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};

export const PERIOD_STATUS = {
  UPCOMING: { label: 'Upcoming', tone: 'info' },
  OPEN: { label: 'Open', tone: 'good' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};

// The rules of a plan year, in the order they are shown, with a simple explanation.
export const RULES = [
  { key: 'employeeResultsShare', label: 'Employee: points for results', unit: 'points', help: 'Out of 100. The rest is for behaviours.' },
  { key: 'managerResultsShare', label: 'Manager: points for results', unit: 'points', help: 'Out of 100. The rest is for behaviours.' },
  { key: 'minKpis', label: 'Fewest KPIs in a plan', unit: '', help: 'Fewer KPIs = people ignore the rest of their work.' },
  { key: 'maxKpis', label: 'Most KPIs in a plan', unit: '', help: 'More KPIs = nothing feels important.' },
  { key: 'minKpiWeight', label: 'Smallest KPI weight', unit: 'points', help: 'A KPI worth less is not worth measuring.' },
  { key: 'maxKpiWeight', label: 'Biggest KPI weight', unit: 'points', help: 'So one KPI can never decide the whole year.' },
  { key: 'achievementCap', label: 'Achievement counted up to', unit: '%', help: 'So one huge result cannot hide a failure.' },
  { key: 'minMonthsForRating', label: 'Months needed for a rating', unit: 'months', help: 'Fewer months in the year = tracked, but not rated (UN rule).' },
  { key: 'appealDays', label: 'Days to appeal', unit: 'days', help: 'After acknowledging a low rating.' },
  { key: 'planDeadlineDays', label: 'Days to sign the plans', unit: 'days', help: 'From the start of the year.' },
  { key: 'safetyCapEnabled', label: 'Safety rule', unit: '', help: 'If on: Safety scored 1 limits the rating to "Partially meets".' },
];

// The rules form sends numbers (and true/false for the safety rule).
export function rulesFromForm(values) {
  return Object.fromEntries(
    RULES.map(({ key }) => [key, key === 'safetyCapEnabled' ? Boolean(values[key]) : Number(values[key])]),
  );
}

// Only the rules that really changed, so the audit log stays clear.
export function changedRules(before, after) {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => before[key] !== value));
}

// The period tree (year → halves → quarters → months) as rows for a table, in order.
// Each row gets a "level": 0 = half, 1 = quarter, 2 = month.
export function periodRows(tree) {
  if (!tree) return [];
  const rows = [];
  for (const half of tree.children ?? []) {
    rows.push({ ...half, level: 0 });
    for (const quarter of half.children ?? []) {
      rows.push({ ...quarter, level: 1 });
      for (const month of quarter.children ?? []) rows.push({ ...month, level: 2 });
    }
  }
  return rows;
}

// "2019 EFY · Hamle 2018" → "Hamle 2018"
export function shortPeriodName(name) {
  const parts = name.split(' · ');
  return parts[parts.length - 1];
}
