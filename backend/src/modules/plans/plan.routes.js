// The URLs of plans and KPIs (version 2). Mounted at /api/plans and /api/kpis in app.js.
// Every logged-in role reaches these routes; WHO may do WHAT is decided in the services
// (see plan.access.js), because it depends on the plan: its level, company and status.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './plan.controller.js';
import * as progress from '../progress/progress.controller.js';
import * as changes from '../change-requests/changeRequest.controller.js';
import { createRequestSchema } from '../change-requests/changeRequest.validation.js';
import { actualSchema, commentSchema, kpiMonthParamsSchema, planPeriodParamsSchema } from '../progress/progress.validation.js';
import {
  acknowledgePlanSchema,
  createKpiSchema,
  createPlanSchema,
  listPlansQuerySchema,
  monthTargetsSchema,
  returnPlanSchema,
  updateKpiSchema,
} from './plan.validation.js';

const withId = validate(idParamSchema, 'params');

export const planRoutes = Router();
planRoutes.use(authenticate());
planRoutes.get('/', validate(listPlansQuerySchema, 'query'), controller.list);
planRoutes.get('/:id', withId, controller.getById);
planRoutes.post('/', validate(createPlanSchema), controller.create);
planRoutes.post('/:id/submit', withId, controller.submit);
planRoutes.post('/:id/approve', withId, controller.approve);
planRoutes.post('/:id/return', withId, validate(returnPlanSchema), controller.returnPlan);
planRoutes.post('/:id/activate', withId, controller.activate);
planRoutes.post('/:id/acknowledge', withId, validate(acknowledgePlanSchema), controller.acknowledge);
planRoutes.delete('/:id', withId, controller.remove);
// Module 13: monthly actual numbers and progress.
planRoutes.get('/:id/progress', withId, progress.get);
planRoutes.post('/:id/months/:periodId/confirm', validate(planPeriodParamsSchema, 'params'), progress.confirmMonth);
planRoutes.put('/:id/reviews/:periodId', validate(planPeriodParamsSchema, 'params'), validate(commentSchema), progress.saveComment);

export const kpiRoutes = Router();
kpiRoutes.use(authenticate());
kpiRoutes.post('/', validate(createKpiSchema), controller.createKpi);
kpiRoutes.patch('/:id', withId, validate(updateKpiSchema), controller.updateKpi);
kpiRoutes.delete('/:id', withId, controller.deleteKpi);
kpiRoutes.put('/:id/months', withId, validate(monthTargetsSchema), controller.setMonthTargets);
kpiRoutes.put('/:id/months/:periodId/actual', validate(kpiMonthParamsSchema, 'params'), validate(actualSchema), progress.enterActual);
kpiRoutes.post('/:id/months/:periodId/confirm', validate(kpiMonthParamsSchema, 'params'), progress.confirmActual);
// Module 17: ask for (or, for the Head, make) a change of the year target of an ACTIVE plan.
kpiRoutes.post('/:id/change-requests', withId, validate(createRequestSchema), changes.create);
