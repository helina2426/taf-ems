// Rules for the data the plan and KPI endpoints accept.
// Rules that need the database (who may write, links between levels, weights of the year…)
// are checked in the services.

import { z } from 'zod';
import { optionalText } from '../../shared/validation.js';

export const PLAN_LEVELS = ['HOLDING', 'COMPANY', 'INDIVIDUAL'];
export const PLAN_STATUSES = ['DRAFT', 'SUBMITTED', 'RETURNED', 'ACTIVE'];
const PERSPECTIVES = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH'];
const DIRECTIONS = ['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'EXACT', 'ZERO'];
const AGGREGATIONS = ['SUM', 'AVERAGE', 'LAST'];

const MAX_NUMBER = 99_999_999_999;
const amount = (label) =>
  z
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(MAX_NUMBER, `${label} is too big.`)
    .transform((value) => Math.round(value * 100) / 100); // 2 decimals, like the database

// ---------- Plans ----------

export const listPlansQuerySchema = z.object({
  planYearId: z.uuid('planYearId is not valid.').optional(),
  level: z.enum(PLAN_LEVELS).optional(),
  companyId: z.uuid('companyId is not valid.').optional(),
  status: z.enum(PLAN_STATUSES).optional(),
});

export const createPlanSchema = z.object({
  planYearId: z.uuid('Choose a plan year.'),
  level: z.enum(PLAN_LEVELS, { error: 'level must be HOLDING, COMPANY or INDIVIDUAL.' }),
  employeeId: z.uuid('employeeId is not valid.').optional(), // INDIVIDUAL plans only
});

export const returnPlanSchema = z.object({
  comment: z
    .string({ error: 'Write why the plan is returned.' })
    .trim()
    .min(10, 'Write at least 10 characters, so the Manager knows what to fix.')
    .max(1000, 'Must be at most 1000 characters.'),
});

export const acknowledgePlanSchema = z.object({
  comment: optionalText(1000),
});

// ---------- KPIs ----------

const kpiFields = {
  perspective: z.enum(PERSPECTIVES, { error: 'Choose a perspective.' }),
  name: z.string({ error: 'Name is required.' }).trim().min(2, 'Name must be at least 2 characters.').max(120, 'Name must be at most 120 characters.'),
  description: optionalText(500),
  unit: z.string({ error: 'Unit is required.' }).trim().min(1, 'Unit is required, for example "deliveries" or "%".').max(30, 'Unit must be at most 30 characters.'),
  direction: z.enum(DIRECTIONS, { error: 'Choose which result is good.' }),
  aggregation: z.enum(AGGREGATIONS, { error: 'Choose how the months add up.' }),
  baseline: amount('Baseline').nullable().optional(),
  yearTarget: amount('Year target'),
  weight: z.number({ error: 'Weight must be a whole number of points.' }).int('Weight must be a whole number of points.').min(1).max(100).nullable().optional(),
  parentKpiId: z.uuid('Choose the KPI of the level above.').nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
};

export const createKpiSchema = z.object({
  planId: z.uuid('planId is not valid.'),
  ...kpiFields,
  aggregation: kpiFields.aggregation.default('SUM'),
});

export const updateKpiSchema = z
  .object(kpiFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to change.' });

export const monthTargetsSchema = z.object({
  targets: z.array(amount('Monthly target'), { error: 'targets must be a list of 12 numbers.' }).length(12, 'There must be exactly 12 monthly targets.'),
});
