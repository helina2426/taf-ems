// Rules for the data the check-in endpoints accept.

import { z } from 'zod';
import { optionalText, paginationFields } from '../../shared/validation.js';
import { isMonday } from './checkIn.rules.js';

const monday = (label) =>
  z.iso
    .date(`${label} must use the format YYYY-MM-DD, for example 2026-11-16.`)
    .refine(isMonday, `${label} must be a Monday (a week starts on Monday).`);

const note = (label) =>
  z.string({ error: `${label} is required.` }).trim().min(2, `${label} is required.`).max(1000, 'Must be at most 1000 characters.');

export const weekParamSchema = z.object({ weekStart: monday('The week in the URL') });

export const weekQuerySchema = z.object({
  weekStart: monday('weekStart').optional(),
  companyId: z.uuid('companyId is not valid.').optional(),
});

export const historyQuerySchema = z.object({
  employeeId: z.uuid('employeeId is not valid.').optional(),
  ...paginationFields,
});

export const checkInSchema = z.object({
  done: note('"What I did this week"'),
  next: note('"What I will do next week"'),
  blockers: optionalText(1000),
});

export const replySchema = z.object({
  reply: note('The reply'),
});
