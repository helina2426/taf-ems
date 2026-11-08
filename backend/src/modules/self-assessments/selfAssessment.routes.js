// The URLs of the self-assessment module. Mounted at /api/self-assessments in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './selfAssessment.controller.js';
import { overviewQuerySchema, periodParamSchema, saveDraftSchema } from './selfAssessment.validation.js';

const router = Router();

router.use(authenticate());

// The author's own self-assessments: employees, and managers about their own work.
// These come BEFORE '/:id' so that "mine" is not mistaken for an id.
const author = authorize('EMPLOYEE', 'MANAGER');
const withPeriod = validate(periodParamSchema, 'params');

router.get('/mine', author, controller.listMine);
router.get('/mine/:periodId', author, withPeriod, controller.getMineForPeriod);
router.put('/mine/:periodId', author, withPeriod, validate(saveDraftSchema), controller.saveMyDraft);
router.post('/mine/:periodId/submit', author, withPeriod, controller.submitMine);

// Readers: who has submitted, and the submitted texts (Manager: own company; Holding: all).
router.get('/', authorize('HOLDING', 'MANAGER'), validate(overviewQuerySchema, 'query'), controller.overview);

// One self-assessment (access is checked in the service).
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

export default router;