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