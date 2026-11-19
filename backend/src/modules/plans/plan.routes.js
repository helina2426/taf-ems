// The URLs of plans and KPIs (version 2). Mounted at /api/plans and /api/kpis in app.js.
// Every logged-in role reaches these routes; WHO may do WHAT is decided in the services
// (see plan.access.js), because it depends on the plan: its level, company and status.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './plan.controller.js';
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

export const kpiRoutes = Router();
kpiRoutes.use(authenticate());
kpiRoutes.post('/', validate(createKpiSchema), controller.createKpi);
kpiRoutes.patch('/:id', withId, validate(updateKpiSchema), controller.updateKpi);
kpiRoutes.delete('/:id', withId, controller.deleteKpi);
kpiRoutes.put('/:id/months', withId, validate(monthTargetsSchema), controller.setMonthTargets);
