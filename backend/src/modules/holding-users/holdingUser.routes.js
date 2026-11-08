// The URLs of the Holding user module. Mounted at /api/holding-users in app.js.
// Every route is for Holding users; the "primary only" rule is checked in the service.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './holdingUser.controller.js';
import {
  approvalPermissionSchema,
  createHoldingUserSchema,
  holdingUserStatusSchema,
  listHoldingUsersQuerySchema,
} from './holdingUser.validation.js';

const router = Router();

router.use(authenticate(), authorize('HOLDING'));

const withId = validate(idParamSchema, 'params');

router.get('/', validate(listHoldingUsersQuerySchema, 'query'), controller.list);
router.get('/:id', withId, controller.getById);
router.post('/', validate(createHoldingUserSchema), controller.create);
router.patch('/:id/approval-permission', withId, validate(approvalPermissionSchema), controller.setApprovalPermission);
router.patch('/:id/status', withId, validate(holdingUserStatusSchema), controller.setStatus);

export default router;
