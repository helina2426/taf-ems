// Database access for READING the audit log.
// (Writing happens through shared/auditLog.js, used by every module.)

import prisma from '../../config/prisma.js';

export async function findMany(where, { skip, take }) {
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' }, // newest first
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total };
}
