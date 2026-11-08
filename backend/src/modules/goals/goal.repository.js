// Database access for performance goals and their progress history.

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';

const goalInclude = {
  employee: { include: { company: true } },
  period: true,
  createdBy: { select: { email: true } },
};

const goalWithHistoryInclude = {
  ...goalInclude,
  progressUpdates: {
    include: { updatedBy: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  },
};

function buildWhere({ status, employeeId, periodId, companyId }) {
  return {
    ...(status && { status }),
    ...(employeeId && { employeeId }),
    ...(periodId && { periodId }),
    ...(companyId && { employee: { companyId } }),
  };
}

export async function findMany(filters, { skip, take }) {
  const where = buildWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.performanceGoal.findMany({
      where,
      include: goalInclude,
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.performanceGoal.count({ where }),
  ]);
  return { items, total };
}

export function findById(id, db = prisma) {
  return db.performanceGoal.findUnique({ where: { id }, include: goalWithHistoryInclude });
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

export function create(data, db = prisma) {
  return db.performanceGoal.create({ data, include: goalWithHistoryInclude });
}

export function update(id, data, db = prisma) {
  return db.performanceGoal.update({ where: { id }, data, include: goalWithHistoryInclude });
}

export function createProgressUpdate(data, db = prisma) {
  return db.goalProgressUpdate.create({ data });
}

// A goal is overdue when its deadline has passed and it is still not completed or cancelled.
function isOverdue(goal) {
  if (!goal.deadline || ['COMPLETED', 'CANCELLED'].includes(goal.status)) return false;
  return toDateOnly(goal.deadline) < toDateOnly(new Date());
}

export function toGoalResponse(goal) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    objectives: goal.objectives,
    kpi: goal.kpi,
    targetResult: goal.targetResult,
    deadline: toDateOnly(goal.deadline),
    progressPercent: goal.progressPercent,
    status: goal.status,
    isOverdue: isOverdue(goal),
    employee: {
      id: goal.employee.id,
      employeeNumber: goal.employee.employeeNumber,
      firstName: goal.employee.firstName,
      lastName: goal.employee.lastName,
    },
    company: { id: goal.employee.company.id, name: goal.employee.company.name, code: goal.employee.company.code },
    period: goal.period ? { id: goal.period.id, name: goal.period.name, status: goal.period.status } : null,
    createdBy: goal.createdBy?.email ?? null,
    ...(goal.progressUpdates && {
      progressHistory: goal.progressUpdates.map((u) => ({
        progressPercent: u.progressPercent,
        comment: u.comment,
        updatedBy: u.updatedBy?.email ?? null,
        updatedAt: u.createdAt,
      })),
    }),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}