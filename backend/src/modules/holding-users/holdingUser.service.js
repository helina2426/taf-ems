// The business rules for Holding user accounts (our decisions 2–4).
//
//   • Every Holding user can SEE the list of Holding users.
//   • Only the PRIMARY Holding user (the head of the organization) can:
//       – create new Holding user accounts,
//       – switch approval permission on or off for the others,
//       – deactivate or reactivate them.
//   • Nobody can change the primary Holding user's own permission or status here,
//     so the organization can never lose its last approver by mistake.
//   • New accounts must change their temporary password at first login.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { hashPassword } from '../../shared/password.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as repository from './holdingUser.repository.js';

function assertPrimary(user) {
  if (!user.isPrimaryHoldingUser) {
    throw AppError.forbidden('Only the primary Holding user can do this.');
  }
}

async function getOtherHoldingUserOrFail(id, db) {
  const target = await repository.findHoldingUserById(id, db);
  if (!target) throw AppError.notFound('Holding user not found.');
  if (target.isPrimaryHoldingUser) {
    throw AppError.conflict("The primary Holding user's permissions and status cannot be changed.");
  }
  return target;
}

export async function listHoldingUsers(query) {
  const { items, total } = await repository.findMany(query, toSkipTake(query));
  return { items: items.map(repository.toHoldingUserResponse), pagination: buildPagination(query, total) };
}

export async function getHoldingUser(id) {
  const target = await repository.findHoldingUserById(id);
  if (!target) throw AppError.notFound('Holding user not found.');
  return repository.toHoldingUserResponse(target);
}

export async function createHoldingUser({ email, temporaryPassword, canApproveEvaluations }, user) {
  assertPrimary(user);
  const passwordHash = await hashPassword(temporaryPassword);

  const created = await prisma.$transaction(async (tx) => {
    if (await repository.findUserByEmail(email, tx)) {
      throw AppError.conflict('An account with this email already exists.');
    }
    const newUser = await repository.create({ email, passwordHash, canApproveEvaluations }, tx);
    await recordAudit(
      { userId: user.id, action: 'HOLDING_USER_CREATED', entityType: 'User', entityId: newUser.id, details: { email, canApproveEvaluations } },
      tx,
    );
    return newUser;
  });

  return repository.toHoldingUserResponse(created);
}

export async function setApprovalPermission(id, { canApproveEvaluations }, user) {
  assertPrimary(user);

  const updated = await prisma.$transaction(async (tx) => {
    const target = await getOtherHoldingUserOrFail(id, tx);
    const changed = await repository.update(id, { canApproveEvaluations }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: canApproveEvaluations ? 'APPROVAL_PERMISSION_GRANTED' : 'APPROVAL_PERMISSION_REVOKED',
        entityType: 'User',
        entityId: id,
        details: { email: target.email, from: target.canApproveEvaluations, to: canApproveEvaluations },
      },
      tx,
    );
    return changed;
  });

  return repository.toHoldingUserResponse(updated);
}

export async function setHoldingUserStatus(id, { isActive }, user) {
  assertPrimary(user);

  const updated = await prisma.$transaction(async (tx) => {
    const target = await getOtherHoldingUserOrFail(id, tx);
    const changed = await repository.update(id, { isActive }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: isActive ? 'HOLDING_USER_ACTIVATED' : 'HOLDING_USER_DEACTIVATED',
        entityType: 'User',
        entityId: id,
        details: { email: target.email },
      },
      tx,
    );
    return changed;
  });

  return repository.toHoldingUserResponse(updated);
}
