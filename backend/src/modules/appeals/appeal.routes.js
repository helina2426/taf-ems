// The URLs of appeals (version 2, Module 18). Mounted at /api/appeals in app.js;
// an appeal is made at POST /api/evaluations/:id/appeal (evaluation.routes.js).
// WHO may do WHAT is checked in the service.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './appeal.controller.js';
import { decideAppealSchema, listAppealsQuerySchema } from './appeal.validation.js';

const router = Router();
router.use(authenticate());
router.get('/', validate(listAppealsQuerySchema, 'query'), controller.list);
router.post('/:id/decide', validate(idParamSchema, 'params'), validate(decideAppealSchema), controller.decide);

export default router;
