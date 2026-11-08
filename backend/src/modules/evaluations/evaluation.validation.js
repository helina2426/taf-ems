// Rules for the data the evaluation endpoints accept.

import { z } from 'zod';
import { optionalText, paginationFields } from '../../shared/validation.js';

export const EVALUATION_STATUSES = ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'PUBLISHED'];
export const EVALUATION_TYPES = ['EMPLOYEE', 'MANAGER'];

// The shortest feedback accepted when SUBMITTING (a draft can have less).
export const MIN_FEEDBACK_LENGTH = 20;

export const createEvaluationSchema = z.object({
  employeeId: z.uuid('employeeId must be a valid id.'),
  periodId: z.uuid('periodId must be a valid id.'),
});

const oneScore = z.object({
  criterionId: z.uuid('criterionId must be a valid id.'),
  score: z
    .number({ error: 'score must be a whole number from 1 to 5.' })
    .int('score must be a whole number from 1 to 5.')
    .min(1, 'score must be from 1 to 5.')
    .max(5, 'score must be from 1 to 5.'),
  comment: optionalText(1000),
});

export const saveScoresSchema = z.object({
  scores: z
    .array(oneScore, { error: 'scores must be a list.' })
    .min(1, 'Send at least one score.')
    .refine((list) => new Set(list.map((s) => s.criterionId)).size === list.length, {
      message: 'Each criterion can appear only once.',
    }),
});

export const updateEvaluationSchema = z
  .object({
    feedback: optionalText(5000),
    recommendations: optionalText(5000),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Send feedback and/or recommendations.' });

// ---------- Review and publication (Module 9) ----------

// Approving: a comment is optional.
export const approveSchema = z.object({
  comment: optionalText(2000),
});

// Returning: the reason is REQUIRED, so the evaluator knows what to fix.
export const returnSchema = z.object({
  comment: z
    .string({ error: 'Write the reason for returning the evaluation.' })
    .trim()
    .min(10, 'The reason must be at least 10 characters.')
    .max(2000, 'The reason must be at most 2000 characters.'),
});

// Acknowledging: the person evaluated may add one optional comment.
export const acknowledgeSchema = z.object({
  comment: optionalText(2000),
});

export const listEvaluationsQuerySchema = z.object({
  ...paginationFields,
  periodId: z.uuid('periodId must be a valid id.').optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
  employeeId: z.uuid('employeeId must be a valid id.').optional(),
  status: z.enum(EVALUATION_STATUSES).optional(),
  type: z.enum(EVALUATION_TYPES).optional(),
});
