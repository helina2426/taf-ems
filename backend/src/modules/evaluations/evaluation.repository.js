// Database access for evaluations and their scores.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

export const evaluationInclude = {
  period: true,
  company: true,
  employee: { include: { user: { select: { id: true, role: true } } } },
  evaluator: { select: { email: true } },
  publishedBy: { select: { email: true } },
  scores: { include: { criterion: true }, orderBy: { weightUsed: 'desc' } },
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
  return db.evaluationPeriod.findUnique({ where: { id } });
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

export function deleteScoresNotIn(evaluationId, criterionIds, db = prisma) {
  return db.evaluationScore.deleteMany({ where: { evaluationId, criterionId: { notIn: criterionIds } } });
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
