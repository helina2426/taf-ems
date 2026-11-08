// Rules for the data the evaluation-criteria endpoints accept.

import { z } from 'zod';

export const CRITERION_LISTS = ['EMPLOYEE', 'MANAGER'];

const name = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(100, 'Name must be at most 100 characters.');

const description = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters.')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

// A weight is a percentage, like 25 or 12.5, with at most 2 decimals.
const weight = z
  .number({ error: 'Weight must be a number, for example 25.' })
  .gt(0, 'Weight must be more than 0.')
  .max(100, 'Weight must be 100 or less.')
  // value × 100 must be a whole number (12.5 → 1250 ✓, 12.345 → 1234.5 ✗).
  // We allow a tiny difference because computers store some decimals imprecisely.
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
    message: 'Weight can have at most 2 decimals.',
  });

export const createCriterionSchema = z.object({
  name,
  description,
  appliesTo: z.enum(CRITERION_LISTS, { error: 'appliesTo must be EMPLOYEE or MANAGER.' }),
  weight,
});

export const updateCriterionSchema = z
  .object({ name, description, weight })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const criterionStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false.' }),
});

export const listCriteriaQuerySchema = z.object({
  appliesTo: z.enum(CRITERION_LISTS).optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});