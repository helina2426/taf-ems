// Database access for evaluation criteria.

import prisma from '../../config/prisma.js';

export function findMany({ appliesTo, isActive }) {
  return prisma.evaluationCriterion.findMany({
    where: { ...(appliesTo && { appliesTo }), ...(isActive !== undefined && { isActive }) },
    orderBy: [{ appliesTo: 'asc' }, { isActive: 'desc' }, { weight: 'desc' }, { name: 'asc' }],
  });
}

export function findById(id, db = prisma) {
  return db.evaluationCriterion.findUnique({ where: { id } });
}

export function findActiveByName(appliesTo, name, excludeId, db = prisma) {
  return db.evaluationCriterion.findFirst({
    where: {
      appliesTo,
      isActive: true,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  });
}

// The total weight of the ACTIVE criteria in each list, e.g. { EMPLOYEE: 100, MANAGER: 100 }.
export async function activeWeightTotals(db = prisma) {
  const groups = await db.evaluationCriterion.groupBy({
    by: ['appliesTo'],
    where: { isActive: true },
    _sum: { weight: true },
  });

  const totals = { EMPLOYEE: 0, MANAGER: 0 };
  for (const group of groups) {
    // Decimal values come back as special objects; Number() turns them into normal numbers.
    totals[group.appliesTo] = Number(group._sum.weight ?? 0);
  }
  return totals;
}

export function create(data, db = prisma) {
  return db.evaluationCriterion.create({ data });
}

export function update(id, data, db = prisma) {
  return db.evaluationCriterion.update({ where: { id }, data });
}

export function toCriterionResponse(criterion) {
  return {
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    appliesTo: criterion.appliesTo,
    weight: Number(criterion.weight),
    isActive: criterion.isActive,
    createdAt: criterion.createdAt,
    updatedAt: criterion.updatedAt,
  };
}

// A short summary the frontend can show, e.g. "Employee criteria: 110% — must be exactly 100%".
export function toTotalsResponse(totals) {
  return Object.fromEntries(
    Object.entries(totals).map(([list, total]) => [list, { activeWeightTotal: total, isComplete: total === 100 }]),
  );
}