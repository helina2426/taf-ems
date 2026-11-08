// Rules for the audit log search filters.

import { z } from 'zod';
import { paginationFields, requiredDate } from '../../shared/validation.js';

export const listAuditLogsQuerySchema = z
  .object({
    ...paginationFields,
    action: z.string().trim().toUpperCase().max(60).optional(), // e.g. EVALUATION_APPROVED
    userId: z.uuid('userId must be a valid id.').optional(),
    entityType: z.string().trim().max(60).optional(), // e.g. Evaluation, Company, User
    entityId: z.uuid('entityId must be a valid id.').optional(),
    from: requiredDate('from').optional(),
    to: requiredDate('to').optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" must be on or before "to".', path: ['to'] });
