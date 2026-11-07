// The URLs of the company module. Mounted at /api/companies in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as companyController from './company.controller.js';
import {
  companyStatusSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from './company.validation.js';

const router = Router();

// Every company route needs a logged-in user.
router.use(authenticate());

// Holding: all companies.
router.get('/', authorize('HOLDING'), validate(listCompaniesQuerySchema, 'query'), companyController.list);

// Holding: any company. Manager: only their own (checked in the service).
router.get('/:id', authorize('HOLDING', 'MANAGER'), validate(idParamSchema, 'params'), companyController.getById);

// Holding only: create, update, activate/deactivate.
router.post('/', authorize('HOLDING'), validate(createCompanySchema), companyController.create);

router.patch(
  '/:id',
  authorize('HOLDING'),
  validate(idParamSchema, 'params'),
  validate(updateCompanySchema),
  companyController.update,
);

router.patch(
  '/:id/status',
  authorize('HOLDING'),
  validate(idParamSchema, 'params'),
  validate(companyStatusSchema),
  companyController.setStatus,
);

export default router;