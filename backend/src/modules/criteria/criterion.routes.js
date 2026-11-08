// The URLs of the evaluation-criteria module. Mounted at /api/evaluation-criteria in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as criterionController from './criterion.controller.js';
import {
  createCriterionSchema,
  criterionStatusSchema,
  listCriteriaQuerySchema,
  updateCriterionSchema,
} from './criterion.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
const holdingOnly = authorize('HOLDING');

// Everyone logged in can read the criteria: people should know what they are scored on.
router.get('/', validate(listCriteriaQuerySchema, 'query'), criterionController.list);
router.get('/:id', withId, criterionController.getById);

// Only Holding users change them.
router.post('/', holdingOnly, validate(createCriterionSchema), criterionController.create);
router.patch('/:id', holdingOnly, withId, validate(updateCriterionSchema), criterionController.update);
router.patch('/:id/status', holdingOnly, withId, validate(criterionStatusSchema), criterionController.setStatus);

export default router;