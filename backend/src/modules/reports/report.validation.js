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

// Version 2 (Module 19): the plan-year report. Both are optional:
//   no planYearId → the active plan year that contains today; no companyId → every company (Holding).
export const planYearQuerySchema = z.object({
  planYearId: z.uuid('planYearId must be a valid id.').optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
});
