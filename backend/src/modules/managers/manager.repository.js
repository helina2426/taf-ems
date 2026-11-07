// Database access for managers. A "manager" is a User with role MANAGER,
// plus their Employee profile and their ManagerAssignment rows.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

// What we load with every manager: profile, current company, and full assignment history.
const managerInclude = {
  employee: true,
  managerAssignments: {
    include: {
      company: true,
      assignedBy: { select: { id: true, email: true } },
    },
    orderBy: { startDate: 'desc' },
  },
};

function buildWhere({ search, isActive, assigned, companyId }) {
  const activeAssignment = { endDate: null, ...(companyId && { companyId }) };

  return {
    role: 'MANAGER',
    ...(isActive !== undefined && { isActive }),
    ...(companyId && { managerAssignments: { some: activeAssignment } }),
    ...(assigned === true && !companyId && { managerAssignments: { some: { endDate: null } } }),
    ...(assigned === false && { managerAssignments: { none: { endDate: null } } }),
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
}

export async function findMany(filters, { skip, take }) {
  const where = buildWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, include: managerInclude, orderBy: { email: 'asc' }, skip, take }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

export function findManagerById(id, db = prisma) {
  return db.user.findFirst({ where: { id, role: 'MANAGER' }, include: managerInclude });
}

export function findUserByEmail(email, excludeId, db = prisma) {
  return db.user.findFirst({ where: { email, ...(excludeId && { NOT: { id: excludeId } }) } });
}

export function findCompanyById(id, db = prisma) {
  return db.company.findUnique({ where: { id } });
}

export function findEmployeeNumberInCompany(companyId, employeeNumber, excludeEmployeeId, db = prisma) {
  return db.employee.findFirst({
    where: { companyId, employeeNumber, ...(excludeEmployeeId && { NOT: { id: excludeEmployeeId } }) },
  });
}

// Locks the company's row until the transaction ends. If two people try to assign
// a Manager to the SAME company at the same moment, the second one waits for the
// first to finish — so the company can never end up with two active Managers.
export function lockCompany(companyId, db) {
  return db.$executeRaw`SELECT id FROM "Company" WHERE id = ${companyId}::uuid FOR UPDATE`;
}

// The same idea for the Manager's own account (a Manager runs only one company).
export function lockUser(userId, db) {
  return db.$executeRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
}

export function findActiveAssignmentOfCompany(companyId, db = prisma) {
  return db.managerAssignment.findFirst({ where: { companyId, endDate: null } });
}

export function findActiveAssignmentOfManager(managerUserId, db = prisma) {
  return db.managerAssignment.findFirst({ where: { managerUserId, endDate: null }, include: { company: true } });
}

export function endAssignment(assignmentId, db = prisma) {
  return db.managerAssignment.update({ where: { id: assignmentId }, data: { endDate: new Date() } });
}

export function createAssignment(data, db = prisma) {
  return db.managerAssignment.create({ data });
}

export function createManagerUser({ email, passwordHash }, db = prisma) {
  return db.user.create({
    data: { email, passwordHash, role: 'MANAGER', mustChangePassword: true },
  });
}

export function createEmployeeProfile(data, db = prisma) {
  return db.employee.create({ data });
}

export function updateUser(id, data, db = prisma) {
  return db.user.update({ where: { id }, data });
}

export function updateEmployee(id, data, db = prisma) {
  return db.employee.update({ where: { id }, data });
}

// Turns a database manager into the object the API sends back. Never includes the password.
export function toManagerResponse(user, { withHistory = false } = {}) {
  const current = user.managerAssignments?.find((assignment) => assignment.endDate === null);

  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    employee: user.employee
      ? {
          id: user.employee.id,
          employeeNumber: user.employee.employeeNumber,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          jobTitle: user.employee.jobTitle,
          department: user.employee.department,
          phone: user.employee.phone,
        }
      : null,
    currentCompany: current
      ? { id: current.company.id, name: current.company.name, code: current.company.code, assignedAt: current.startDate }
      : null,
    ...(withHistory && {
      assignmentHistory: user.managerAssignments.map((assignment) => ({
        company: { id: assignment.company.id, name: assignment.company.name, code: assignment.company.code },
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        assignedBy: assignment.assignedBy?.email ?? null,
      })),
    }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}