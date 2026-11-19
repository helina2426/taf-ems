// Rules for the data the target-change endpoints accept.

import { z } from 'zod';
import { optionalText } from '../../shared/validation.js';

export const createRequestSchema = z.object({
  yearTarget: z
    .number({ error: 'Enter the new year target.' })
    .min(0, 'The target cannot be negative.')
    .max(99_999_999_999, 'The number is too big.')
    .transform((value) => Math.round(value * 100) / 100),
  reason: z.string({ error: 'Explain why the target must change.' }).trim().min(10, 'Explain why the target must change (at least 10 characters).').max(2000, 'Must be at most 2000 characters.'),
});

export const approveSchema = z.object({ comment: optionalText(2000) });

export const rejectSchema = z.object({
  comment: z.string({ error: 'Explain why the change is rejected.' }).trim().min(10, 'Explain why the change is rejected (at least 10 characters).').max(2000, 'Must be at most 2000 characters.'),
});

export const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  planId: z.uuid('planId is not valid.').optional(),
  kpiId: z.uuid('kpiId is not valid.').optional(),
});
