// The rules of a plan year, and the checks that they can work together.
// Pure functions (no database), so they are easy to unit-test.

// The same defaults as in the database schema (used to check the rules before the year exists).
export const DEFAULT_RULES = {
  employeeResultsShare: 70,
  managerResultsShare: 80,
  minKpis: 3,
  maxKpis: 7,
  minKpiWeight: 10,
  maxKpiWeight: 40,
  achievementCap: 120,
  minMonthsForRating: 6,
  appealDays: 14,
  planDeadlineDays: 30,
  safetyCapEnabled: false,
};

// Checks that the rules can work together. `rules` = all the rules (saved values + changes).
// Returns a list of problems (empty = all good).
export function checkRules(rules) {
  const problems = [];
  if (rules.minKpis > rules.maxKpis) {
    problems.push({ field: 'maxKpis', message: 'Maximum KPIs must be at least the minimum.' });
  }
  if (rules.minKpiWeight > rules.maxKpiWeight) {
    problems.push({ field: 'maxKpiWeight', message: 'Maximum KPI weight must be at least the minimum.' });
  }
  // A plan must be possible: with the fewest, lightest KPIs the total must not already be too high,
  // and with the most, heaviest KPIs it must be able to reach the share.
  for (const [field, label] of [['employeeResultsShare', 'employee'], ['managerResultsShare', 'Manager']]) {
    const share = rules[field];
    if (rules.minKpis * rules.minKpiWeight > share || rules.maxKpis * rules.maxKpiWeight < share) {
      problems.push({
        field,
        message: `With these KPI limits a ${label} plan can never add up to ${share} points. Check the number of KPIs and the weights.`,
      });
    }
  }
  return problems;
}
