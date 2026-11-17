// The URLs of the settings module (version 2). Mounted at /api/settings in app.js.
// Holding users can read the settings; only the primary Holding user (the Head) can change them
// (checked in the service).

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './settings.controller.js';
import { updateSettingsSchema } from './settings.validation.js';

const router = Router();

router.use(authenticate(), authorize('HOLDING'));

router.get('/', controller.get);
router.patch('/', validate(updateSettingsSchema), controller.update);

export default router;
