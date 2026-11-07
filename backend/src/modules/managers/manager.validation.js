// Rules for the data the manager endpoints accept.

import { z } from 'zod';
import { optionalText, paginationFields, requiredEmail, strongPassword } from '../../shared/validation.js';

const personName = (label) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(100, `${label} must be at most 100 characters.`);

const employeeNumber = z
  .string({ error: 'Employee number is required.' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,30}$/, 'Employee number may contain only letters, numbers and hyphens (max 30).');

export const createManagerSchema = z.object({
  email: requiredEmail,
  temporaryPassword: strongPassword('Temporary password'),
  firstName: personName('First name'),
  lastName: personName('Last name'),
  employeeNumber,
  jobTitle: optionalText(100),
  department: optionalText(100),
  phone: optionalText(30),
  // The company this Manager will run. They are assigned to it immediately.
  companyId: z.uuid('companyId must be a valid id.'),
});

export const updateManagerSchema = z
  .object({
    email: requiredEmail,
    firstName: personName('First name'),
    lastName: personName('Last name'),
    jobTitle: optionalText(100),
    department: optionalText(100),
    phone: optionalText(30),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const managerStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false.' }),
});

export const assignManagerSchema = z.object({
  companyId: z.uuid('companyId must be a valid id.'),
});

export const listManagersQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  assigned: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
});