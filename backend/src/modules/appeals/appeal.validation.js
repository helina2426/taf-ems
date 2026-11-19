// Rules for the data the appeal endpoints accept.

import { z } from 'zod';

export const createAppealSchema = z.object({
  reason: z.string({ error: 'Explain why you appeal.' }).trim().min(20, 'Explain why you appeal (at least 20 characters).').max(3000, 'Must be at most 3000 characters.'),
});

export const decideAppealSchema = z.object({
  outcome: z.enum(['RATING_KEPT', 'RATING_CHANGED'], { error: 'outcome must be RATING_KEPT or RATING_CHANGED.' }),
  newScore: z.number({ error: 'The new score must be a number from 0 to 100.' }).min(0, 'From 0 to 100.').max(100, 'From 0 to 100.').transform((v) => Math.round(v * 100) / 100).optional(),
  comment: z.string({ error: 'Explain the decision.' }).trim().min(20, 'Explain the decision (at least 20 characters).').max(3000, 'Must be at most 3000 characters.'),
});

export const listAppealsQuerySchema = z.object({
  status: z.enum(['SUBMITTED', 'DECIDED']).optional(),
});
