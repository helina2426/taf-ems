// The URLs of the evaluation module. Mounted at /api/evaluations in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './evaluation.controller.js';
import {
  acknowledgeSchema,
  approveSchema,
  createEvaluationSchema,
  listEvaluationsQuerySchema,
  returnSchema,
  saveScoresSchema,
  updateEvaluationSchema,
} from './evaluation.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
// Evaluators: Managers (for employees) and Holding users (for Managers). The exact rule
// — whose evaluation each one may write — is checked in the service.
const evaluator = authorize('MANAGER', 'HOLDING');

// Reading (who sees what is checked in the service).
router.get('/', validate(listEvaluationsQuerySchema, 'query'), controller.list);
router.get('/:id', withId, controller.getById);

// Writing.
router.post('/', evaluator, validate(createEvaluationSchema), controller.create);
router.put('/:id/scores', evaluator, withId, validate(saveScoresSchema), controller.saveScores);
router.patch('/:id', evaluator, withId, validate(updateEvaluationSchema), controller.update);
router.post('/:id/submit', evaluator, withId, controller.submit);

// Review and publication: Holding approvers only (the exact permission is checked in the service).
const reviewer = authorize('HOLDING');
router.post('/:id/approve', reviewer, withId, validate(approveSchema), controller.approve);
router.post('/:id/return', reviewer, withId, validate(returnSchema), controller.returnForCorrection);
router.post('/:id/publish', reviewer, withId, controller.publish);

// The person evaluated confirms they have read it (any role: Employees and Managers are both evaluated).
router.post('/:id/acknowledge', withId, validate(acknowledgeSchema), controller.acknowledge);

export default router;
