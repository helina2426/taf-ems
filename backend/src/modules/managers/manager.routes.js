// The URLs of the manager module. Mounted at /api/managers in app.js.
// Every route here is for Holding users only.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as managerController from './manager.controller.js';
import {
  assignManagerSchema,
  createManagerSchema,
  listManagersQuerySchema,
  managerStatusSchema,
  updateManagerSchema,
} from './manager.validation.js';

const router = Router();

router.use(authenticate(), authorize('HOLDING'));

const withId = validate(idParamSchema, 'params');

router.get('/', validate(listManagersQuerySchema, 'query'), managerController.list);
router.get('/:id', withId, managerController.getById);
router.post('/', validate(createManagerSchema), managerController.create);
router.patch('/:id', withId, validate(updateManagerSchema), managerController.update);
router.patch('/:id/status', withId, validate(managerStatusSchema), managerController.setStatus);

// Assign this Manager to a company (replaces that company's current Manager), or unassign them.
router.put('/:id/assignment', withId, validate(assignManagerSchema), managerController.assign);
router.delete('/:id/assignment', withId, managerController.unassign);

export default router;