// Rules for the data the self-assessment endpoints accept.

import { z } from 'zod';
import { paginationFields } from '../../shared/validation.js';

export const SELF_ASSESSMENT_STATES = ['NOT_STARTED', 'DRAFT', 'SUBMITTED'];

// The shortest text accepted when SUBMITTING (a draft can be shorter).
export const MIN_SUBMIT_LENGTH = 20;

export const periodParamSchema = z.object({
  periodId: z.uuid('The period id in the URL is not valid.'),
});

export const saveDraftSchema = z.object({
  comments: z
    .string({ error: 'comments is required.' })
    .trim()
    .max(5000, 'comments must be at most 5000 characters.'),
});

export const overviewQuerySchema = z.object({
  ...paginationFields,
  periodId: z.uuid('periodId must be a valid id.'),
  status: z.enum(SELF_ASSESSMENT_STATES).optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
});