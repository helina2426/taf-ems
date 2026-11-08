// The URLs of the employee module. Mounted at /api/employees in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as employeeController from './employee.controller.js';
import {
  createEmployeeSchema,
  employmentStatusSchema,
  listEmployeesQuerySchema,
  transferEmployeeSchema,
  updateEmployeeSchema,
  updateMyProfileSchema,
} from './employee.validation.js';

const router = Router();

router.use(authenticate());

const withId = validate(idParamSchema, 'params');
const holdingOrManager = authorize('HOLDING', 'MANAGER');

// An employee's own profile. These come BEFORE '/:id', otherwise Express would
// treat the word "me" as an id.
router.get('/me', authorize('EMPLOYEE'), employeeController.getMe);
router.patch('/me', authorize('EMPLOYEE'), validate(updateMyProfileSchema), employeeController.updateMe);

// Holding: all companies. Manager: own company only (checked in the service).
router.get('/', holdingOrManager, validate(listEmployeesQuerySchema, 'query'), employeeController.list);
router.get('/:id', holdingOrManager, withId, employeeController.getById);
router.post('/', holdingOrManager, validate(createEmployeeSchema), employeeController.create);
router.patch('/:id', holdingOrManager, withId, validate(updateEmployeeSchema), employeeController.update);
router.patch('/:id/status', holdingOrManager, withId, validate(employmentStatusSchema), employeeController.setStatus);

// Moving an employee to another company: Holding only.
router.put('/:id/company', authorize('HOLDING'), withId, validate(transferEmployeeSchema), employeeController.transfer);

export default router;