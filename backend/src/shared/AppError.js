// A custom error type for problems we expect and understand,
// such as "not found" (404) or "not allowed" (403).
// It carries an HTTP status code so the error handler knows what to reply.
// It can also carry a short "code" (like PASSWORD_CHANGE_REQUIRED) that the
// frontend can check, instead of reading the message text.

export class AppError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }

  // Shortcuts for the most common errors, so other files can write
  // AppError.notFound('Employee not found') instead of new AppError(404, ...).
  static badRequest(message = 'The request data is invalid.', details) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'You must be logged in.') {
    return new AppError(401, message);
  }

  static forbidden(message = 'You do not have permission to do this.', code) {
    return new AppError(403, message, undefined, code);
  }

  static notFound(message = 'The requested resource was not found.') {
    return new AppError(404, message);
  }

  static conflict(message = 'This conflicts with existing data.') {
    return new AppError(409, message);
  }
}