// The URLs of target changes (version 2, Module 17). Mounted at /api/change-requests in app.js;
// a new request is made at POST /api/kpis/:id/change-requests (plan.routes.js).
// WHO may do WHAT is checked in the service.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './changeRequest.controller.js';
import { approveSchema, listQuerySchema, rejectSchema } from './changeRequest.validation.js';

const router = Router();
router.use(authenticate());

const withId = validate(idParamSchema, 'params');
router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.post('/:id/approve', withId, validate(approveSchema), controller.approve);
router.post('/:id/reject', withId, validate(rejectSchema), controller.reject);

export default router;
