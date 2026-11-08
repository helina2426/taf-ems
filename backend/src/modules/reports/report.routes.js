// The URLs of the reports module. Mounted at /api/reports in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './report.controller.js';
import { employeeIdParamSchema, periodQuerySchema } from './report.validation.js';

const router = Router();

router.use(authenticate());

const withPeriod = validate(periodQuerySchema, 'query');

// Everyone: a summary made for their role.
router.get('/dashboard', withPeriod, controller.dashboard);

// Holding (all companies) and Managers (own company only).
router.get('/completion', authorize('HOLDING', 'MANAGER'), withPeriod, controller.completion);

// Holding only.
router.get('/companies', authorize('HOLDING'), withPeriod, controller.companies);
router.get('/managers', authorize('HOLDING'), withPeriod, controller.managers);

// One employee's report: who may see it is checked in the service.
router.get('/employees/:employeeId', validate(employeeIdParamSchema, 'params'), controller.employee);

export default router;
