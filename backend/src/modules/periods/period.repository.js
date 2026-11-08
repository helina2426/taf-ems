// Database access for evaluation periods.

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';

const periodInclude = {
  createdBy: { select: { email: true } },
  _count: { select: { goals: true, selfAssessments: true, evaluations: true } },
};

export function findMany({ status }) {
  return prisma.evaluationPeriod.findMany({
    where: { ...(status && { status }) },
    include: periodInclude,
    orderBy: { startDate: 'desc' },
  });
}

export function findById(id, db = prisma) {
  return db.evaluationPeriod.findUnique({ where: { id }, include: periodInclude });
}

export function findByName(name, excludeId, db = prisma) {
  return db.evaluationPeriod.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId && { NOT: { id: excludeId } }) },
  });
}

export function countOpen(db = prisma) {
  return db.evaluationPeriod.count({ where: { status: 'OPEN' } });
}

export function create(data, db = prisma) {
  return db.evaluationPeriod.create({ data, include: periodInclude });
}

export function update(id, data, db = prisma) {
  return db.evaluationPeriod.update({ where: { id }, data, include: periodInclude });
}

export function toPeriodResponse(period) {
  return {
    id: period.id,
    name: period.name,
    startDate: toDateOnly(period.startDate),
    endDate: toDateOnly(period.endDate),
    status: period.status,
    createdBy: period.createdBy?.email ?? null,
    counts: {
      goals: period._count?.goals ?? 0,
      selfAssessments: period._count?.selfAssessments ?? 0,
      evaluations: period._count?.evaluations ?? 0,
    },
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}