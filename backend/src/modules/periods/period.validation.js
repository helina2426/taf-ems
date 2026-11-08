// Rules for the data the evaluation-period endpoints accept.

import { z } from 'zod';
import { requiredDate } from '../../shared/validation.js';

export const PERIOD_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED'];

const name = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(3, 'Name must be at least 3 characters.')
  .max(100, 'Name must be at most 100 characters.');

export const createPeriodSchema = z
  .object({
    name,
    startDate: requiredDate('Start date'),
    endDate: requiredDate('End date'),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after the start date.',
    path: ['endDate'],
  });

// For updates the dates are checked again in the service, together with the saved values.
export const updatePeriodSchema = z
  .object({
    name,
    startDate: requiredDate('Start date'),
    endDate: requiredDate('End date'),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const periodStatusSchema = z.object({
  status: z.enum(PERIOD_STATUSES, { error: 'status must be UPCOMING, OPEN or CLOSED.' }),
});

export const listPeriodsQuerySchema = z.object({
  status: z.enum(PERIOD_STATUSES).optional(),
});