// Database access for Holding user accounts.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

export async function findMany({ isActive }, { skip, take }) {
  const where = { role: 'HOLDING', ...(isActive !== undefined && { isActive }) };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      // The primary Holding user first, then by email.
      orderBy: [{ isPrimaryHoldingUser: 'desc' }, { email: 'asc' }],
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

// Finds a user only if they are a Holding user (a Manager's id gives "not found").
export function findHoldingUserById(id, db = prisma) {
  return db.user.findFirst({ where: { id, role: 'HOLDING' } });
}

export function findUserByEmail(email, db = prisma) {
  return db.user.findUnique({ where: { email } });
}

export function create({ email, passwordHash, canApproveEvaluations }, db = prisma) {
  return db.user.create({
    data: {
      email,
      passwordHash,
      role: 'HOLDING',
      canApproveEvaluations,
      isPrimaryHoldingUser: false, // there is only one primary Holding user, set in the seed
      mustChangePassword: true,
    },
  });
}

export function update(id, data, db = prisma) {
  return db.user.update({ where: { id }, data });
}

// The safe view of a Holding user. NEVER includes the password hash.
export function toHoldingUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    isPrimaryHoldingUser: user.isPrimaryHoldingUser,
    // The primary Holding user can always approve.
    canApproveEvaluations: user.isPrimaryHoldingUser || user.canApproveEvaluations,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
