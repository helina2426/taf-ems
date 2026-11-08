// Rules for the data the employee endpoints accept.

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

// A date like 2024-01-15. An empty value means "no date".
const optionalDate = z.preprocess(
  (value) => (value === '' ? null : value),
  z.iso
    .date('Use the date format YYYY-MM-DD, for example 2024-01-15.')
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
);

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'];

// The work details a Manager or Holding user may set.
const profileFields = {
  employeeNumber,
  firstName: personName('First name'),
  lastName: personName('Last name'),
  jobTitle: optionalText(100),
  department: optionalText(100),
  phone: optionalText(30),
  address: optionalText(300),
  emergencyContact: optionalText(200),
  hireDate: optionalDate,
};

export const createEmployeeSchema = z.object({
  email: requiredEmail,
  temporaryPassword: strongPassword('Temporary password'),
  ...profileFields,
  // Holding users must say which company. Managers can leave it out: their own company is used.
  companyId: z.uuid('companyId must be a valid id.').optional(),
});

export const updateEmployeeSchema = z
  .object({ email: requiredEmail, ...profileFields })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const employmentStatusSchema = z.object({
  employmentStatus: z.enum(EMPLOYMENT_STATUSES, {
    error: `employmentStatus must be one of: ${EMPLOYMENT_STATUSES.join(', ')}.`,
  }),
});

export const transferEmployeeSchema = z.object({
  companyId: z.uuid('companyId must be a valid id.'),
});

// What employees may change about THEMSELVES (assumption 20 in the design document).
// "strictObject" rejects any other field, e.g. an employee trying to change their own job title.
export const updateMyProfileSchema = z
  .strictObject(
    {
      phone: optionalText(30),
      address: optionalText(300),
      emergencyContact: optionalText(200),
    },
    { error: 'You can only change: phone, address, emergencyContact.' },
  )
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const listEmployeesQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  department: z.string().trim().max(100).optional(),
  companyId: z.uuid('companyId must be a valid id.').optional(),
});