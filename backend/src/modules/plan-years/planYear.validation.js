// Rules for the data the plan-year endpoints accept.
// Rules that need several values together (for example "minKpis ≤ maxKpis") are checked
// in the service, together with the values already saved.

import { z } from 'zod';

export const CYCLE_STATUSES = ['PLANNING', 'ACTIVE', 'CLOSED'];
export const MONTH_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED'];

const whole = (label, min, max) =>
  z
    .number({ error: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be at most ${max}.`);

// The rules of a plan year, with the allowed range of each one.
export const ruleFields = {
  employeeResultsShare: whole('Employee results share', 50, 90),
  managerResultsShare: whole('Manager results share', 50, 90),
  minKpis: whole('Minimum KPIs', 1, 10),
  maxKpis: whole('Maximum KPIs', 1, 15),
  minKpiWeight: whole('Minimum KPI weight', 1, 50),
  maxKpiWeight: whole('Maximum KPI weight', 1, 90),
  achievementCap: whole('Achievement cap', 100, 200),
  minMonthsForRating: whole('Minimum months for a rating', 0, 12),
  appealDays: whole('Appeal days', 1, 60),
  planDeadlineDays: whole('Plan deadline days', 1, 120),
  safetyCapEnabled: z.boolean({ error: 'safetyCapEnabled must be true or false.' }),
};

export const RULE_NAMES = Object.keys(ruleFields);

const year = z.coerce
  .number({ error: 'Year is required.' })
  .int('Year must be a whole number, for example 2019.')
  .min(2000, 'Year must be between 2000 and 2100.')
  .max(2100, 'Year must be between 2000 and 2100.');

export const createPlanYearSchema = z.object({ year, ...ruleFields }).partial({
  ...Object.fromEntries(RULE_NAMES.map((name) => [name, true])),
});

export const updatePlanYearSchema = z
  .object(ruleFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one rule to change.' });

export const planYearStatusSchema = z.object({
  status: z.enum(CYCLE_STATUSES, { error: 'status must be PLANNING, ACTIVE or CLOSED.' }),
});

export const monthStatusSchema = z.object({
  status: z.enum(MONTH_STATUSES, { error: 'status must be UPCOMING, OPEN or CLOSED.' }),
});

export const listPlanYearsQuerySchema = z.object({
  status: z.enum(CYCLE_STATUSES).optional(),
});

export const previewQuerySchema = z.object({ year });
