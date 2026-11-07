// The business rules for managers.
//
// Main rules (SRS FR-02, FR-03 and our design decisions):
//   • Only Holding users manage Managers (checked in the routes).
//   • A company has at most ONE active Manager. Assigning a new one ends the old assignment
//     in the same transaction.
//   • A Manager runs at most ONE company at a time.
//   • A Manager's employee profile always belongs to the company they run.
//   • New accounts must change their temporary password at first login.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { hashPassword } from '../../shared/password.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as managerRepository from './manager.repository.js';

export async function listManagers(query) {
  const { items, total } = await managerRepository.findMany(query, toSkipTake(query));
  return {
    items: items.map((user) => managerRepository.toManagerResponse(user)),
    pagination: buildPagination(query, total),
  };
}

async function getManagerOrFail(id, db) {
  const manager = await managerRepository.findManagerById(id, db);
  if (!manager) {
    throw AppError.notFound('Manager not found.');
  }
  return manager;
}

export async function getManager(id) {
  const manager = await getManagerOrFail(id);
  return managerRepository.toManagerResponse(manager, { withHistory: true });
}

async function getActiveCompanyOrFail(companyId, db) {
  const company = await managerRepository.findCompanyById(companyId, db);
  if (!company) {
    throw AppError.notFound('Company not found.');
  }
  if (!company.isActive) {
    throw AppError.conflict('This company is inactive. Activate it before assigning a Manager.');
  }
  return company;
}

// Makes "managerUserId" the one active Manager of "companyId".
// Must be called inside a transaction (tx). Returns the id of the Manager who was replaced, if any.
async function assignInTransaction({ managerUserId, companyId, assignedById }, tx) {
  // Lock both rows so two assignments can never happen at the same time.
  await managerRepository.lockCompany(companyId, tx);
  await managerRepository.lockUser(managerUserId, tx);

  // Rule: a Manager runs only one company at a time.
  const managersCurrent = await managerRepository.findActiveAssignmentOfManager(managerUserId, tx);
  if (managersCurrent) {
    if (managersCurrent.companyId === companyId) {
      throw AppError.conflict('This Manager is already assigned to this company.');
    }
    throw AppError.conflict(
      `This Manager already runs ${managersCurrent.company.name}. Unassign them from that company first.`,
    );
  }

  // Rule: one active Manager per company. End the current one's assignment, if any.
  const companysCurrent = await managerRepository.findActiveAssignmentOfCompany(companyId, tx);
  if (companysCurrent) {
    await managerRepository.endAssignment(companysCurrent.id, tx);
  }

  await managerRepository.createAssignment({ companyId, managerUserId, assignedById }, tx);

  return companysCurrent?.managerUserId ?? null;
}

export async function createManager(data, user) {
  const { email, temporaryPassword, companyId, ...profile } = data;
  const passwordHash = await hashPassword(temporaryPassword);

  const result = await prisma.$transaction(async (tx) => {
    await getActiveCompanyOrFail(companyId, tx);

    if (await managerRepository.findUserByEmail(email, null, tx)) {
      throw AppError.conflict('An account with this email already exists.');
    }
    if (await managerRepository.findEmployeeNumberInCompany(companyId, profile.employeeNumber, null, tx)) {
      throw AppError.conflict('This employee number is already used in this company.');
    }

    const newUser = await managerRepository.createManagerUser({ email, passwordHash }, tx);
    await managerRepository.createEmployeeProfile({ ...profile, userId: newUser.id, companyId }, tx);

    const replacedManagerId = await assignInTransaction(
      { managerUserId: newUser.id, companyId, assignedById: user.id },
      tx,
    );

    await recordAudit(
      {
        userId: user.id,
        action: 'MANAGER_CREATED',
        entityType: 'User',
        entityId: newUser.id,
        details: { email, companyId, ...profile },
      },
      tx,
    );
    await recordAudit(
      {
        userId: user.id,
        action: 'MANAGER_ASSIGNED',
        entityType: 'Company',
        entityId: companyId,
        details: { managerUserId: newUser.id, replacedManagerUserId: replacedManagerId },
      },
      tx,
    );

    const manager = await managerRepository.findManagerById(newUser.id, tx);
    return { manager, replacedManagerId };
  });

  return {
    manager: managerRepository.toManagerResponse(result.manager, { withHistory: true }),
    replacedManagerId: result.replacedManagerId,
  };
}

export async function assignManager(managerUserId, { companyId }, user) {
  const result = await prisma.$transaction(async (tx) => {
    const manager = await getManagerOrFail(managerUserId, tx);
    if (!manager.isActive) {
      throw AppError.conflict('This Manager account is inactive. Activate it before assigning.');
    }
    await getActiveCompanyOrFail(companyId, tx);

    // The Manager's employee profile moves to the company they will run.
    if (manager.employee && manager.employee.companyId !== companyId) {
      const clash = await managerRepository.findEmployeeNumberInCompany(
        companyId,
        manager.employee.employeeNumber,
        manager.employee.id,
        tx,
      );
      if (clash) {
        throw AppError.conflict(
          "The Manager's employee number is already used in that company. Change it before assigning.",
        );
      }
    }

    const replacedManagerId = await assignInTransaction({ managerUserId, companyId, assignedById: user.id }, tx);

    if (manager.employee && manager.employee.companyId !== companyId) {
      await managerRepository.updateEmployee(manager.employee.id, { companyId }, tx);
    }

    await recordAudit(
      {
        userId: user.id,
        action: 'MANAGER_ASSIGNED',
        entityType: 'Company',
        entityId: companyId,
        details: { managerUserId, replacedManagerUserId: replacedManagerId },
      },
      tx,
    );

    const updated = await managerRepository.findManagerById(managerUserId, tx);
    return { manager: updated, replacedManagerId };
  });

  return {
    manager: managerRepository.toManagerResponse(result.manager, { withHistory: true }),
    replacedManagerId: result.replacedManagerId,
  };
}

export async function unassignManager(managerUserId, user) {
  const manager = await prisma.$transaction(async (tx) => {
    await getManagerOrFail(managerUserId, tx);
    await managerRepository.lockUser(managerUserId, tx);

    const current = await managerRepository.findActiveAssignmentOfManager(managerUserId, tx);
    if (!current) {
      throw AppError.conflict('This Manager is not assigned to any company.');
    }

    await managerRepository.endAssignment(current.id, tx);
    await recordAudit(
      {
        userId: user.id,
        action: 'MANAGER_UNASSIGNED',
        entityType: 'Company',
        entityId: current.companyId,
        details: { managerUserId },
      },
      tx,
    );

    return managerRepository.findManagerById(managerUserId, tx);
  });

  return managerRepository.toManagerResponse(manager, { withHistory: true });
}

export async function updateManager(managerUserId, data, user) {
  const { email, ...profile } = data;

  const manager = await prisma.$transaction(async (tx) => {
    const before = await getManagerOrFail(managerUserId, tx);

    if (email !== undefined && email !== before.email) {
      if (await managerRepository.findUserByEmail(email, managerUserId, tx)) {
        throw AppError.conflict('An account with this email already exists.');
      }
      await managerRepository.updateUser(managerUserId, { email }, tx);
    }
    if (Object.keys(profile).length > 0 && before.employee) {
      await managerRepository.updateEmployee(before.employee.id, profile, tx);
    }

    const after = await managerRepository.findManagerById(managerUserId, tx);

    // Record exactly what changed.
    const changes = {};
    if (email !== undefined && before.email !== after.email) {
      changes.email = { from: before.email, to: after.email };
    }
    for (const field of Object.keys(profile)) {
      if (before.employee?.[field] !== after.employee?.[field]) {
        changes[field] = { from: before.employee?.[field] ?? null, to: after.employee?.[field] ?? null };
      }
    }

    await recordAudit(
      { userId: user.id, action: 'MANAGER_UPDATED', entityType: 'User', entityId: managerUserId, details: changes },
      tx,
    );
    return after;
  });

  return managerRepository.toManagerResponse(manager, { withHistory: true });
}

export async function setManagerStatus(managerUserId, { isActive }, user) {
  const manager = await prisma.$transaction(async (tx) => {
    const before = await getManagerOrFail(managerUserId, tx);
    if (before.isActive === isActive) {
      throw AppError.conflict(`This Manager account is already ${isActive ? 'active' : 'inactive'}.`);
    }

    await managerRepository.updateUser(managerUserId, { isActive }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: isActive ? 'MANAGER_ACTIVATED' : 'MANAGER_DEACTIVATED',
        entityType: 'User',
        entityId: managerUserId,
      },
      tx,
    );
    return managerRepository.findManagerById(managerUserId, tx);
  });

  return managerRepository.toManagerResponse(manager, { withHistory: true });
}