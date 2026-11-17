// The URLs of the plan-year module (version 2). Mounted at /api/plan-years in app.js.
//
// A plan year (e.g. "2019 EFY") has 19 periods: 1 year, 2 halves, 4 quarters, 12 months.
// Everyone logged in can READ plan years (they need the months and quarters).
// Only Holding users create and change them.

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './planYear.controller.js';
import {
  createPlanYearSchema,
  listPlanYearsQuerySchema,
  monthStatusSchema,
  planYearStatusSchema,
  previewQuerySchema,
  updatePlanYearSchema,
} from './planYear.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
const withMonth = validate(
  z.object({ id: z.uuid('The id in the URL is not valid.'), periodId: z.uuid('The period id in the URL is not valid.') }),
  'params',
);
const holdingOnly = authorize('HOLDING');

router.get('/', validate(listPlanYearsQuerySchema, 'query'), controller.list);
// "preview" must come before "/:id", otherwise Express would read "preview" as an id.
router.get('/preview', holdingOnly, validate(previewQuerySchema, 'query'), controller.preview);
router.get('/:id', withId, controller.getById);

router.post('/', holdingOnly, validate(createPlanYearSchema), controller.create);
router.patch('/:id', holdingOnly, withId, validate(updatePlanYearSchema), controller.update);
router.patch('/:id/status', holdingOnly, withId, validate(planYearStatusSchema), controller.setStatus);
router.patch('/:id/months/:periodId/status', holdingOnly, withMonth, validate(monthStatusSchema), controller.setMonthStatus);
router.delete('/:id', holdingOnly, withId, controller.remove);

export default router;
