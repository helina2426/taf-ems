// Checks the login token on protected routes.
// If the token is missing, fake, expired, or the account is no longer active → 401.
// If it is valid, it puts the user's details in req.user for the next steps.

import { AppError } from '../shared/AppError.js';
import { passwordStamp, verifyToken } from '../shared/token.js';
import { findUserForAuth, toAuthUser } from '../modules/auth/auth.repository.js';

// Usage:
//   authenticate()                                     → normal protected route
//   authenticate({ allowPasswordChangeRequired: true }) → also allowed BEFORE the
//                                                          first password change
export function authenticate({ allowPasswordChangeRequired = false } = {}) {
  return async (req, res, next) => {
    // 1. Read the token from the header:  Authorization: Bearer <token>
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(AppError.unauthorized('You must be logged in.'));
    }

    // 2. Check the stamp and the expiry time.
    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return next(AppError.unauthorized('Your session is invalid or has expired. Please log in again.'));
    }

    // 3. Look the user up in the database: they might have been deactivated
    //    after the token was made.
    const user = await findUserForAuth(payload.sub);
    const authUser = user && toAuthUser(user);

    if (!authUser || !authUser.isActive) {
      return next(AppError.unauthorized('Your account is not active. Please contact your administrator.'));
    }

    // 3b. Tokens made before the last password change no longer work (Phase 7).
    if (payload.pwd !== passwordStamp(user.passwordHash)) {
      return next(AppError.unauthorized('Your password was changed. Please log in again.'));
    }

    // 4. Until the first password change, only a few routes are allowed.
    if (authUser.mustChangePassword && !allowPasswordChangeRequired) {
      return next(
        AppError.forbidden('You must change your password before continuing.', 'PASSWORD_CHANGE_REQUIRED'),
      );
    }

    req.user = authUser;
    next();
  };
}
