// The single place where ALL errors become a clean JSON response.
// Express recognizes an error handler because it has FOUR parameters (err, req, res, next).

import env from '../config/env.js';
import { AppError } from '../shared/AppError.js';

export function errorHandler(err, req, res, next) {
  // Case 1: the request body was not valid JSON (for example, a missing quote).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { message: 'The request body is not valid JSON.' },
    });
  }

  // Case 1b: the request body is bigger than allowed (see express.json in app.js).
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { message: 'The request is too large.' },
    });
  }

  // Case 2: an error we created on purpose (AppError) — safe to show its message.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.code && { code: err.code }),
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Case 3: a database rule was broken (Prisma error codes).
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      // A unique rule was broken, e.g. two companies with the same code.
      return res.status(409).json({
        success: false,
        error: { message: 'This value is already used by another record.' },
      });
    }
    if (err.code === 'P2025') {
      // The record to update was not found.
      return res.status(404).json({
        success: false,
        error: { message: 'The requested resource was not found.' },
      });
    }
  }

  // Case 4: an unexpected error (a bug). Log the full details on the server,
  // but send the user only a general message, so internal details never leak.
  console.error(err);

  res.status(500).json({
    success: false,
    error: {
      message: 'Something went wrong on the server. Please try again later.',
      ...(env.nodeEnv === 'development' && { debug: err.message }),
    },
  });
}