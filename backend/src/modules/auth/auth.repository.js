// Database access for authentication. Only this file talks to Prisma for auth.

import prisma from '../../config/prisma.js';

// What we load about a user when checking a login or a token:
// their employee profile (with company) and, for Managers, their ACTIVE assignment.
const authInclude = {
  employee: { include: { company: true } },
  managerAssignments: {
    where: { endDate: null },
    include: { company: true },
  },
};

export function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email }, include: authInclude });
}

export function findUserForAuth(id) {
  return prisma.user.findUnique({ where: { id }, include: authInclude });
}

export function updateLastLogin(id) {
  return prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export function updatePassword(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: false },
  });
}

// Turns a database user into the safe object the rest of the app uses.
// It NEVER includes the password hash.
export function toAuthUser(user) {
  // Which company does this person belong to?
  // Managers: the company they are currently assigned to. Employees: their profile's company.
  // Holding users: none (they see all companies).
  const activeAssignment = user.managerAssignments?.[0];
  const company =
    user.role === 'MANAGER' ? activeAssignment?.company : user.role === 'EMPLOYEE' ? user.employee?.company : null;

  // Users of a deactivated company cannot use the system.
  const companyIsActive = company ? company.isActive : true;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isPrimaryHoldingUser: user.isPrimaryHoldingUser,
    canApproveEvaluations: user.canApproveEvaluations,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive && companyIsActive,
    employeeId: user.employee?.id ?? null,
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    firstName: user.employee?.firstName ?? null,
    lastName: user.employee?.lastName ?? null,
    lastLoginAt: user.lastLoginAt,
  };
}