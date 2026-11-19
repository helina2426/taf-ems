// Database access for evaluations and their scores.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

export const evaluationInclude = {
  period: { include: { cycle: { select: { appealDays: true } } } },
  appeal: { include: { decidedBy: { select: { email: true } } } }, // version 2 (Module 18)
  company: true,
  employee: { include: { user: { select: { id: true, role: true } } } },
  evaluator: { select: { email: true } },
  publishedBy: { select: { email: true } },
  scores: { include: { criterion: true, kpi: { select: { name: true, unit: true, direction: true } } }, orderBy: { weightUsed: 'desc' } },
  reviews: { include: { reviewer: { select: { email: true } } }, orderBy: { decidedAt: 'asc' } },
};

export async function findMany(where, { skip, take }) {
  const [items, total] = await prisma.$transaction([
    prisma.evaluation.findMany({
      where,
      include: evaluationInclude,
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take,
    }),
    prisma.evaluation.count({ where }),
  ]);
  return { items, total };
}

export function findById(id, db = prisma) {
  return db.evaluation.findUnique({ where: { id }, include: evaluationInclude });
}

export function findByEmployeeAndPeriod(employeeId, periodId, db = prisma) {
  return db.evaluation.findUnique({ where: { employeeId_periodId: { employeeId, periodId } } });
}

export function findEmployeeById(id, db = prisma) {
  return db.employee.findUnique({ where: { id }, include: { user: true } });
}

export function findEmployeeByUserId(userId, db = prisma) {
  return db.employee.findUnique({ where: { userId } });
}

export function findPeriodById(id, db = prisma) {
  // Version 1 features only use version-1 periods (not the months and quarters of a plan year).
  return db.evaluationPeriod.findFirst({ where: { id, cycleId: null } });
}

// Version 2: any period an evaluation can be made in — a version 1 period, or a plan-year period
// (the service checks it is the first half or the year), with its plan year.
export function findEvaluationPeriod(id, db = prisma) {
  return db.evaluationPeriod.findUnique({ where: { id }, include: { cycle: true } });
}

// The periods to choose from on the evaluations page: version 1 periods, and the first half
// and the year of every plan year that has started (not PLANNING).
export function findEvaluationPeriods(db = prisma) {
  return db.evaluationPeriod.findMany({
    where: {
      OR: [
        { cycleId: null },
        { cycle: { status: { not: 'PLANNING' } }, OR: [{ type: 'YEAR' }, { type: 'HALF', sequence: 1 }] },
      ],
    },
    include: { cycle: true },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });
}

export function findActiveCriteria(appliesTo, db = prisma) {
  return db.evaluationCriterion.findMany({ where: { appliesTo, isActive: true } });
}

export function findSubmittedSelfAssessment(employeeId, periodId, db = prisma) {
  return db.selfAssessment.findFirst({ where: { employeeId, periodId, status: 'SUBMITTED' } });
}

export function create(data, db = prisma) {
  return db.evaluation.create({ data, include: evaluationInclude });
}

export function update(id, data, db = prisma) {
  return db.evaluation.update({ where: { id }, data, include: evaluationInclude });
}

// Saves one criterion's score: creates it the first time, replaces it after that.
export function upsertScore({ evaluationId, criterionId, score, comment, weightUsed }, db = prisma) {
  return db.evaluationScore.upsert({
    where: { evaluationId_criterionId: { evaluationId, criterionId } },
    create: { evaluationId, criterionId, score, comment: comment ?? null, weightUsed },
    update: { score, comment: comment ?? null, weightUsed },
  });
}

// Removes the behaviour scores of behaviours that are no longer active (KPI rows are not touched).
export function deleteScoresNotIn(evaluationId, criterionIds, db = prisma) {
  return db.evaluationScore.deleteMany({ where: { evaluationId, criterionId: { not: null, notIn: criterionIds } } });
}

// Version 2: saves ("freezes") the KPI scores at submission, replacing any earlier ones.
export async function replaceKpiScores(evaluationId, rows, db = prisma) {
  await db.evaluationScore.deleteMany({ where: { evaluationId, kpiId: { not: null } } });
  if (rows.length > 0) await db.evaluationScore.createMany({ data: rows.map((r) => ({ ...r, evaluationId })) });
}

// ---------- Review and publication (Module 9) ----------

// Changes the status ONLY IF it is still "fromStatus". Returns how many rows changed (0 or 1).
// If two reviewers click at the same moment, the second one changes 0 rows and gets an error,
// instead of both decisions being saved.
export async function changeStatus(id, fromStatus, data, db = prisma) {
  const { count } = await db.evaluation.updateMany({ where: { id, status: fromStatus }, data });
  return count;
}

export function createReview({ evaluationId, reviewerId, decision, comment }, db = prisma) {
  return db.evaluationReview.create({ data: { evaluationId, reviewerId, decision, comment: comment ?? null } });
}
