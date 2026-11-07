// Rules for the data the auth endpoints accept.

import { z } from 'zod';
import { requiredEmail, strongPassword } from '../../shared/validation.js';

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Current password is required.' }).min(1, 'Current password is required.'),
    newPassword: strongPassword('New password'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password.',
    path: ['newPassword'],
  });