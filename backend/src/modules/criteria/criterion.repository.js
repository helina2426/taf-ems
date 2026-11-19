// Database access for evaluation criteria.

import prisma from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.ts';

// A JSON column needs a special value to be emptied ("no level descriptions").
function toDb(data) {
  if (data.levelDescriptions === null) return { ...data, levelDescriptions: Prisma.DbNull };
  return data;
}

export function findMany({ appliesTo, isActive }) {
  return prisma.evaluationCriterion.findMany({
    where: { ...(appliesTo && { appliesTo }), ...(isActive !== undefined && { isActive }) },
    orderBy: [{ appliesTo: 'asc' }, { isActive: 'desc' }, { isSafety: 'desc' }, { weight: 'desc' }, { name: 'asc' }],
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

// Version 2: the active Safety behaviour of a list (there may be only one).
export function findActiveSafety(appliesTo, excludeId, db = prisma) {
  return db.evaluationCriterion.findFirst({
    where: { appliesTo, isActive: true, isSafety: true, ...(excludeId && { NOT: { id: excludeId } }) },
  });
}

export function findActive(db = prisma) {
  return db.evaluationCriterion.findMany({ where: { isActive: true } });
}

export function deactivateAll(db = prisma) {
  return db.evaluationCriterion.updateMany({ where: { isActive: true }, data: { isActive: false } });
}

export function createMany(rows, db = prisma) {
  return db.evaluationCriterion.createMany({ data: rows.map(toDb) });
}

export function create(data, db = prisma) {
  return db.evaluationCriterion.create({ data: toDb(data) });
}

export function update(id, data, db = prisma) {
  return db.evaluationCriterion.update({ where: { id }, data: toDb(data) });
}

export function toCriterionResponse(criterion) {
  return {
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    appliesTo: criterion.appliesTo,
    weight: Number(criterion.weight),
    isActive: criterion.isActive,
    // Version 2: what 1, 2, 3, 4 and 5 look like (null = not described yet), and the Safety flag.
    levelDescriptions: criterion.levelDescriptions ?? null,
    isSafety: criterion.isSafety,
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