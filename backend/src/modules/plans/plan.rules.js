// The rules of plans and KPIs that can be checked without the database.
// Pure functions, so they are easy to unit-test (test/unit/planRules.test.js).

export const PERSPECTIVES = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH'];

// Tiny differences (like 0.004) come from rounding money-like numbers to 2 decimals.
const SAME = 0.01;
const round2 = (value) => Math.round(value * 100) / 100;

// Splits a year target into 12 monthly targets.
//   SUM     (things you count):         1,200 → 100 each month (the last month takes the rounding rest)
//   AVERAGE (rates, percentages):       95%   → 95% every month
//   LAST    (a level at a moment):      500   → 500 every month (the year result is the last month)
//   ZERO direction (accidents…):        0 every month
export function splitYearTarget(yearTarget, aggregation, direction) {
  if (direction === 'ZERO') return Array(12).fill(0);
  if (aggregation !== 'SUM') return Array(12).fill(round2(yearTarget));

  const cents = Math.round(yearTarget * 100);
  const base = Math.floor(cents / 12);
  const months = Array(12).fill(base / 100);
  months[11] = (cents - base * 11) / 100;
  return months;
}

// Checks 12 monthly targets typed by hand. Returns a message, or null when they are fine.
export function checkMonthTargets(targets, yearTarget, aggregation) {
  if (!Array.isArray(targets) || targets.length !== 12) return 'There must be exactly 12 monthly targets.';
  if (targets.some((t) => typeof t !== 'number' || !Number.isFinite(t) || t < 0)) {
    return 'Every monthly target must be a number of 0 or more.';
  }
  if (aggregation === 'SUM') {
    const total = round2(targets.reduce((sum, t) => sum + t, 0));
    if (Math.abs(total - yearTarget) > SAME) return `The 12 months add up to ${total}, but the year target is ${yearTarget}.`;
  } else if (aggregation === 'AVERAGE') {
    const average = round2(targets.reduce((sum, t) => sum + t, 0) / 12);
    if (Math.abs(average - yearTarget) > SAME) return `The average of the 12 months is ${average}, but the year target is ${yearTarget}.`;
  } else if (Math.abs(targets[11] - yearTarget) > SAME) {
    return `For a "last month" KPI, the 12th month must equal the year target (${yearTarget}).`;
  }
  return null;
}

// How many points the KPIs of a plan must add up to.
export function resultsShareFor(level, rules) {
  if (level === 'COMPANY') return rules.managerResultsShare;
  if (level === 'INDIVIDUAL') return rules.employeeResultsShare;
  return null; // the Holding plan has no weights
}

// Is the plan complete enough to be submitted (company) or activated (Holding, employee)?
// `kpis` = [{ name, perspective, weight, parentKpiId }], `rules` = the rules of the plan year.
// Returns a list of problems in simple words (empty = ready).
export function checkPlanReady(level, kpis, rules) {
  const problems = [];
  if (level === 'HOLDING') {
    if (kpis.length === 0) problems.push('Add at least one KPI.');
    return problems;
  }

  const share = resultsShareFor(level, rules);
  if (kpis.length < rules.minKpis || kpis.length > rules.maxKpis) {
    problems.push(`A plan needs between ${rules.minKpis} and ${rules.maxKpis} KPIs (now ${kpis.length}).`);
  }
  for (const kpi of kpis) {
    if (kpi.weight === null || kpi.weight === undefined) {
      problems.push(`"${kpi.name}" has no weight.`);
    } else if (kpi.weight < rules.minKpiWeight || kpi.weight > rules.maxKpiWeight) {
      problems.push(`"${kpi.name}" weighs ${kpi.weight} points; each KPI must weigh between ${rules.minKpiWeight} and ${rules.maxKpiWeight}.`);
    }
    if (!kpi.parentKpiId) problems.push(`"${kpi.name}" is not linked to a KPI of the level above.`);
  }
  const total = kpis.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0);
  if (total !== share) problems.push(`The weights add up to ${total} points; they must add up to ${share}.`);

  if (level === 'COMPANY') {
    const missing = PERSPECTIVES.filter((p) => !kpis.some((kpi) => kpi.perspective === p));
    if (missing.length > 0) {
      problems.push(`A company plan needs at least one KPI in every perspective. Missing: ${missing.map(perspectiveLabel).join(', ')}.`);
    }
  }
  return problems;
}

export function perspectiveLabel(perspective) {
  return { FINANCIAL: 'Financial', CUSTOMER: 'Customer', INTERNAL_PROCESS: 'Internal process', LEARNING_GROWTH: 'Learning & growth' }[perspective];
}

// For a KPI of the level above: do the KPIs linked to it add up to its target?
// Only meaningful for SUM KPIs. Returns a warning text, or null.
export function cascadeWarning(parent, children) {
  if (parent.aggregation !== 'SUM' || children.length === 0) return null;
  const total = round2(children.reduce((sum, child) => sum + child.yearTarget, 0));
  if (total + SAME < parent.yearTarget) {
    return `The linked KPIs add up to ${total}, less than this target (${parent.yearTarget}).`;
  }
  return null;
}
