// The URLs of the auth module. Mounted at /api/auth in app.js.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { changePasswordSchema, loginSchema } from './auth.validation.js';

const router = Router();

// These auth routes are allowed even before the first password change.
const loggedIn = authenticate({ allowPasswordChangeRequired: true });

router.post('/login', validate(loginSchema), authController.login);
router.get('/me', loggedIn, authController.me);
router.post('/change-password', loggedIn, validate(changePasswordSchema), authController.changePassword);
router.post('/logout', loggedIn, authController.logout);

export default router;