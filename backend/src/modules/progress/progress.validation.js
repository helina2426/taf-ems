// Rules for the data the progress endpoints accept.

import { z } from 'zod';
import { optionalText } from '../../shared/validation.js';

export const kpiMonthParamsSchema = z.object({
  id: z.uuid('The KPI id in the URL is not valid.'),
  periodId: z.uuid('The month id in the URL is not valid.'),
});

export const planPeriodParamsSchema = z.object({
  id: z.uuid('The plan id in the URL is not valid.'),
  periodId: z.uuid('The period id in the URL is not valid.'),
});

export const actualSchema = z.object({
  actual: z
    .number({ error: 'Enter the real number for this month.' })
    .min(0, 'The number cannot be negative.')
    .max(99_999_999_999, 'The number is too big.')
    .transform((value) => Math.round(value * 100) / 100),
  comment: optionalText(500),
});

export const commentSchema = z.object({
  comment: z.string({ error: 'Write a comment.' }).trim().min(2, 'Write a comment.').max(2000, 'Must be at most 2000 characters.'),
});
