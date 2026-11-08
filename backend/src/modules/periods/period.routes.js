// The URLs of the evaluation-period module. Mounted at /api/evaluation-periods in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as periodController from './period.controller.js';
import {
  createPeriodSchema,
  listPeriodsQuerySchema,
  periodStatusSchema,
  updatePeriodSchema,
} from './period.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
const holdingOnly = authorize('HOLDING');

// Everyone logged in can see the periods.
router.get('/', validate(listPeriodsQuerySchema, 'query'), periodController.list);
router.get('/:id', withId, periodController.getById);

// Only Holding users create and change them.
router.post('/', holdingOnly, validate(createPeriodSchema), periodController.create);
router.patch('/:id', holdingOnly, withId, validate(updatePeriodSchema), periodController.update);
router.patch('/:id/status', holdingOnly, withId, validate(periodStatusSchema), periodController.setStatus);

export default router;