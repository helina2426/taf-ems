// The URL of the audit log. Mounted at /api/audit-logs in app.js. Holding users only, read only.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auditLog.controller.js';
import { listAuditLogsQuerySchema } from './auditLog.validation.js';

const router = Router();

router.get('/', authenticate(), authorize('HOLDING'), validate(listAuditLogsQuerySchema, 'query'), controller.list);

export default router;
