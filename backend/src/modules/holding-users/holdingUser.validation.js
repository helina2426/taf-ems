// Rules for the data the Holding user endpoints accept.

import { z } from 'zod';
import { paginationFields, requiredEmail, strongPassword } from '../../shared/validation.js';

export const createHoldingUserSchema = z.object({
  email: requiredEmail,
  temporaryPassword: strongPassword('Temporary password'),
  // Off by default: the primary Holding user switches it on when they decide to.
  canApproveEvaluations: z.boolean({ error: 'canApproveEvaluations must be true or false.' }).default(false),
});

export const approvalPermissionSchema = z.object({
  canApproveEvaluations: z.boolean({ error: 'canApproveEvaluations must be true or false.' }),
});

export const holdingUserStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false.' }),
});

export const listHoldingUsersQuerySchema = z.object({
  ...paginationFields,
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});
