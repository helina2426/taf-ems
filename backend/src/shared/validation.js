// Validation rules shared by many modules.

import { z } from 'zod';

// For URLs like /api/companies/:id — the id must be a real UUID.
export const idParamSchema = z.object({
  id: z.uuid('The id in the URL is not valid.'),
});

// For list pages: ?page=1&pageSize=20
// Values in the URL are text, so z.coerce turns "2" into the number 2.
export const paginationFields = {
  page: z.coerce.number().int().min(1, 'page must be 1 or more.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'pageSize must be 1 or more.')
    .max(100, 'pageSize must be 100 or less.')
    .default(20),
};

// Turns page numbers into what the database needs (skip/take)
// and what the reply shows (total pages).
export function toSkipTake({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPagination({ page, pageSize }, total) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}


// A strong password: 8–72 characters, with at least one letter and one number.
// (bcrypt ignores anything after 72 characters.)
export const strongPassword = (label = 'Password') =>
  z
    .string({ error: `${label} is required.` })
    .min(8, `${label} must be at least 8 characters.`)
    .max(72, `${label} must be at most 72 characters.`)
    .regex(/[A-Za-z]/, `${label} must contain at least one letter.`)
    .regex(/[0-9]/, `${label} must contain at least one number.`);

// A required email: spaces removed, lowercase, must look like an email.
export const requiredEmail = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

// Optional text: spaces are removed, and an empty value becomes null (= "no value").
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();


// A required date like 2026-01-31. It becomes a JavaScript Date.
export const requiredDate = (label = 'Date') =>
  z.iso
    .date(`${label} must use the format YYYY-MM-DD, for example 2026-01-31.`)
    .transform((value) => new Date(value));

// Dates are sent back as "YYYY-MM-DD" (no time), which is easier to read.
export function toDateOnly(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}    