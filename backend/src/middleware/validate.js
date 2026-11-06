// Checks the request body against a set of rules (a "schema") before it reaches
// the controller. If something is missing or wrong, it replies 400 with a list
// of the problems, field by field.

import { AppError } from '../shared/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(AppError.badRequest('Some fields are missing or invalid.', details));
    }

    // Replace the body with the cleaned-up version (for example, trimmed email).
    req.body = result.data;
    next();
  };
}