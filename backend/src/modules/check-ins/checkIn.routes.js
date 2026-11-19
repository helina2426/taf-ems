// The URLs of weekly check-ins (version 2, Module 14). Mounted at /api/check-ins in app.js.
// Every logged-in role reaches these routes; WHO may do WHAT is checked in the service,
// because it depends on the note (whose it is, which company it belongs to).

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../shared/validation.js';
import * as controller from './checkIn.controller.js';
import { checkInSchema, historyQuerySchema, replySchema, weekParamSchema, weekQuerySchema } from './checkIn.validation.js';

const router = Router();
router.use(authenticate());

router.get('/status', controller.status);
router.get('/week', validate(weekQuerySchema, 'query'), controller.week);
router.get('/', validate(historyQuerySchema, 'query'), controller.list);
router.put('/mine/:weekStart', validate(weekParamSchema, 'params'), validate(checkInSchema), controller.saveMine);
router.delete('/mine/:weekStart', validate(weekParamSchema, 'params'), controller.deleteMine);
router.put('/:id/reply', validate(idParamSchema, 'params'), validate(replySchema), controller.reply);

export default router;
