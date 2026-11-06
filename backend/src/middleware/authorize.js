// Checks the user's ROLE. Use it after authenticate().
// Example:  router.post('/', authenticate(), authorize('HOLDING'), createCompany)
// If the role is not in the allowed list → 403 (logged in, but not allowed).

import { AppError } from '../shared/AppError.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }

    next();
  };
}