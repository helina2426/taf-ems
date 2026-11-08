// Rules for the data the report endpoints accept.

import { z } from 'zod';

// Most reports are "for one evaluation period". If no periodId is sent,
// the service picks a sensible one (see resolvePeriod in report.service.js).
export const periodQuerySchema = z.object({
  periodId: z.uuid('periodId must be a valid id.').optional(),
});

export const employeeIdParamSchema = z.object({
  employeeId: z.uuid('The employee id in the URL is not valid.'),
});
