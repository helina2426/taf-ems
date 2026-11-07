// Checks part of the request against a set of rules (a "schema") before it reaches
// the controller. If something is missing or wrong, it replies 400 with a list
// of the problems, field by field.
//
// Usage:
//   validate(schema)            → checks the JSON body       (result in req.body)
//   validate(schema, 'params')  → checks URL parts like :id   (result in req.validated.params)
//   validate(schema, 'query')   → checks ?page=2&search=...   (result in req.validated.query)

import { AppError } from '../shared/AppError.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(AppError.badRequest('Some fields are missing or invalid.', details));
    }

    // Keep the cleaned-up values (for example, trimmed text, numbers instead of text).
    req.validated = { ...req.validated, [source]: result.data };
    if (source === 'body') {
      req.body = result.data;
    }
    next();
  };
}