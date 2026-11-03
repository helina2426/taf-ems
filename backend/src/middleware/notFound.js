// Runs only when no route matched the request URL.
// Turns it into a 404 error and passes it to the error handler.

import { AppError } from '../shared/AppError.js';

export function notFound(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}