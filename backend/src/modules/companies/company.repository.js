// Database access for companies. Only this file talks to Prisma for companies.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

// What we load with every company: the CURRENT manager and how many employees it has.
const companyInclude = {
  managerAssignments: {
    where: { endDate: null },
    include: { manager: { include: { employee: true } } },
  },
  _count: { select: { employees: true } },
};

function buildWhere({ search, isActive }) {
  return {
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
}

export async function findMany(filters, { skip, take }) {
  const where = buildWhere(filters);

  // Run both queries in one go: the page of companies, and the total count.
  const [items, total] = await prisma.$transaction([
    prisma.company.findMany({ where, include: companyInclude, orderBy: { name: 'asc' }, skip, take }),
    prisma.company.count({ where }),
  ]);

  return { items, total };
}

export function findById(id, db = prisma) {
  return db.company.findUnique({ where: { id }, include: companyInclude });
}

export function findByNameOrCode({ name, code }, excludeId, db = prisma) {
  return db.company.findFirst({
    where: {
      OR: [
        ...(name ? [{ name: { equals: name, mode: 'insensitive' } }] : []),
        ...(code ? [{ code }] : []),
      ],
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  });
}

export function findTheHolding(db = prisma) {
  return db.holding.findFirst();
}

export function create(data, db = prisma) {
  return db.company.create({ data, include: companyInclude });
}

export function update(id, data, db = prisma) {
  return db.company.update({ where: { id }, data, include: companyInclude });
}

// Turns a database company into the object the API sends back.
export function toCompanyResponse(company) {
  const assignment = company.managerAssignments?.[0];
  const manager = assignment?.manager;

  return {
    id: company.id,
    name: company.name,
    code: company.code,
    address: company.address,
    phone: company.phone,
    email: company.email,
    isActive: company.isActive,
    employeeCount: company._count?.employees ?? 0,
    currentManager: manager
      ? {
          userId: manager.id,
          email: manager.email,
          firstName: manager.employee?.firstName ?? null,
          lastName: manager.employee?.lastName ?? null,
          assignedAt: assignment.startDate,
        }
      : null,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}