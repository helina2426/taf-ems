// Rules for the data the goal endpoints accept.

import { z } from 'zod';
import { optionalText, paginationFields } from '../../shared/validation.js';

export const GOAL_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const title = z
  .string({ error: 'Title is required.' })
  .trim()
  .min(3, 'Title must be at least 3 characters.')
  .max(150, 'Title must be at most 150 characters.');

// A deadline like 2026-12-31. An empty value means "no deadline".
const optionalDate = z.preprocess(
  (value) => (value === '' ? null : value),
  z.iso
    .date('Use the date format YYYY-MM-DD, for example 2026-12-31.')
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
);

const goalFields = {
  title,
  description: optionalText(2000),
  objectives: optionalText(2000),
  kpi: optionalText(300),
  targetResult: optionalText(300),
  deadline: optionalDate,
  // Optional: the evaluation period this goal belongs to.
  periodId: z.uuid('periodId must be a valid id.').nullable().optional(),
};

export const createGoalSchema = z.object({
  employeeId: z.uuid('employeeId must be a valid id.'),
  ...goalFields,
});

export const updateGoalSchema = z
  .object(goalFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

// What an employee sends to report progress (assumption 12: a percentage and a comment).
export const progressUpdateSchema = z.object({
  progressPercent: z
    .number({ error: 'progressPercent must be a number from 0 to 100.' })
    .int('progressPercent must be a whole number.')
    .min(0, 'progressPercent must be 0 or more.')
    .max(100, 'progressPercent must be 100 or less.'),
  comment: optionalText(1000),
});

export const listGoalsQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(GOAL_STATUSES).optional(),
  employeeId: z.uuid('employeeId must be a valid id.').optional(),
  periodId: z.uuid('periodId must be a valid id.').optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
});