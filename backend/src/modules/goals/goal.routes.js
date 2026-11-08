// The URLs of the goal module. Mounted at /api/goals in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as goalController from './goal.controller.js';
import { createGoalSchema, listGoalsQuerySchema, progressUpdateSchema, updateGoalSchema } from './goal.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
const managerOnly = authorize('MANAGER');

// Reading: Holding (all), Manager (own company), Employee (own goals) — checked in the service.
router.get('/', validate(listGoalsQuerySchema, 'query'), goalController.list);
router.get('/:id', withId, goalController.getById);

// Managers set and manage goals.
router.post('/', managerOnly, validate(createGoalSchema), goalController.create);
router.patch('/:id', managerOnly, withId, validate(updateGoalSchema), goalController.update);
router.post('/:id/cancel', managerOnly, withId, goalController.cancel);
router.post('/:id/reopen', managerOnly, withId, goalController.reopen);

// Employees report progress on their own goals.
router.post('/:id/progress', authorize('EMPLOYEE'), withId, validate(progressUpdateSchema), goalController.reportProgress);

export default router;