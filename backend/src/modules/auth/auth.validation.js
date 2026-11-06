// Rules for the data the auth endpoints accept.

import { z } from 'zod';

// Email: remove spaces, make lowercase, then check it looks like an email.
const email = z.string({ error: 'Email is required.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Current password is required.' }).min(1, 'Current password is required.'),
    newPassword: z
      .string({ error: 'New password is required.' })
      .min(8, 'New password must be at least 8 characters.')
      .max(72, 'New password must be at most 72 characters.')
      .regex(/[A-Za-z]/, 'New password must contain at least one letter.')
      .regex(/[0-9]/, 'New password must contain at least one number.'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password.',
    path: ['newPassword'],
  });