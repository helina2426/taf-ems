// Rules for the data the company endpoints accept.

import { z } from 'zod';
import { paginationFields } from '../../shared/validation.js';

// Optional text: spaces are removed, and an empty value becomes null (= "no value").
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const name = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(150, 'Name must be at most 150 characters.');

// A short company code like ALPHA or TAF-SOLAR: capital letters, numbers and hyphens.
const code = z
  .string({ error: 'Code is required.' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,20}$/, 'Code must be 2–20 characters: letters, numbers or hyphens.');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'))
  .or(z.literal('').transform(() => null))
  .nullable()
  .optional();

export const createCompanySchema = z.object({
  name,
  code,
  address: optionalText(300),
  phone: optionalText(30),
  email,
});

// For updates every field is optional, but at least one must be sent.
export const updateCompanySchema = createCompanySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to update.' });

export const companyStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false.' }),
});

export const listCompaniesQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});