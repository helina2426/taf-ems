// The business rules for logging in, changing passwords and logging out.

import env from '../../config/env.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { createToken } from '../../shared/token.js';
import * as authRepository from './auth.repository.js';

// A real scrambled password, made once when the server starts. Used when the email
// does not exist, so a wrong email takes the same time as a wrong password.
// Otherwise an attacker could measure response times to find out which emails exist.
const DUMMY_HASH = await hashPassword('dummy-password-for-timing-only');

const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';

export async function login({ email, password }, requestInfo) {
  const user = await authRepository.findUserByEmail(email);

  // Always run the password check, even if the user was not found (see DUMMY_HASH).
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    await recordAudit({
      userId: user?.id ?? null,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user?.id ?? null,
      details: { email, ...requestInfo },
    });
    // Same message whether the email or the password was wrong.
    throw AppError.unauthorized(INVALID_LOGIN_MESSAGE);
  }

  const authUser = authRepository.toAuthUser(user);

  if (!authUser.isActive) {
    await recordAudit({
      userId: user.id,
      action: 'LOGIN_BLOCKED_INACTIVE',
      entityType: 'User',
      entityId: user.id,
      details: requestInfo,
    });
    throw AppError.unauthorized('Your account is not active. Please contact your administrator.');
  }

  await authRepository.updateLastLogin(user.id);
  await recordAudit({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    details: requestInfo,
  });

  const token = await createToken(authUser);

  return {
    token,
    expiresIn: env.jwtExpiresIn,
    user: authUser,
  };
}

export async function changePassword(authUser, { currentPassword, newPassword }) {
  const user = await authRepository.findUserForAuth(authUser.id);

  const passwordMatches = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.badRequest('Some fields are missing or invalid.', [
      { field: 'currentPassword', message: 'Current password is incorrect.' },
    ]);
  }

  const newHash = await hashPassword(newPassword);
  await authRepository.updatePassword(user.id, newHash);

  await recordAudit({
    userId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user.id,
  });
}

export async function logout(authUser, requestInfo) {
  // A token cannot be "taken back"; the frontend deletes it.
  // We record the logout so the audit history is complete.
  await recordAudit({
    userId: authUser.id,
    action: 'LOGOUT',
    entityType: 'User',
    entityId: authUser.id,
    details: requestInfo,
  });
}