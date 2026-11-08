// Database access for self-assessments.

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';

const assessmentInclude = {
  period: true,
  employee: { include: { company: true, user: { select: { role: true } } } },
};

export function findById(id, db = prisma) {
  return db.selfAssessment.findUnique({ where: { id }, include: assessmentInclude });
}

export function findForEmployeeAndPeriod(employeeId, periodId, db = prisma) {
  return db.selfAssessment.findUnique({
    where: { employeeId_periodId: { employeeId, periodId } },
    include: assessmentInclude,
  });
}

export function findAllForEmployee(employeeId) {
  return prisma.selfAssessment.findMany({
    where: { employeeId },
    include: assessmentInclude,
    orderBy: { period: { startDate: 'desc' } },
  });
}

export function findEmployeeByUserId(userId, db = prisma) {
  return db.employee.findUnique({ where: { userId } });
}

export function findPeriodById(id, db = prisma) {
  return db.evaluationPeriod.findUnique({ where: { id } });
}

export function findGoalsForEmployeeAndPeriod(employeeId, periodId) {
  return prisma.performanceGoal.findMany({
    where: { employeeId, periodId },
    orderBy: { createdAt: 'asc' },
  });
}

// Creates the draft the first time, updates it after that ("upsert" = update or insert).
export function saveDraft(employeeId, periodId, comments, db = prisma) {
  return db.selfAssessment.upsert({
    where: { employeeId_periodId: { employeeId, periodId } },
    create: { employeeId, periodId, comments, status: 'DRAFT' },
    update: { comments },
    include: assessmentInclude,
  });
}

export function markSubmitted(id, db = prisma) {
  return db.selfAssessment.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: assessmentInclude,
  });
}

// The overview: every person in scope, with their self-assessment for this period (if any).
export async function findOverview({ periodId, status, companyId, roles }, { skip, take }) {
  const where = {
    user: { role: { in: roles } },
    employmentStatus: { not: 'TERMINATED' },
    ...(companyId && { companyId }),
    ...(status === 'NOT_STARTED' && { selfAssessments: { none: { periodId } } }),
    ...(status === 'DRAFT' && { selfAssessments: { some: { periodId, status: 'DRAFT' } } }),
    ...(status === 'SUBMITTED' && { selfAssessments: { some: { periodId, status: 'SUBMITTED' } } }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: { company: true, user: { select: { role: true } }, selfAssessments: { where: { periodId } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
    }),
    prisma.employee.count({ where }),
  ]);
  return { items, total };
}

function personOf(employee) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    role: employee.user?.role ?? null,
  };
}

function companyOf(employee) {
  return { id: employee.company.id, name: employee.company.name, code: employee.company.code };
}

export function toAssessmentResponse(assessment) {
  return {
    id: assessment.id,
    period: { id: assessment.period.id, name: assessment.period.name, status: assessment.period.status },
    employee: personOf(assessment.employee),
    company: companyOf(assessment.employee),
    status: assessment.status,
    comments: assessment.comments,
    submittedAt: assessment.submittedAt,
    updatedAt: assessment.updatedAt,
  };
}

// One row of the overview. Draft text is private: only submitted text is shown.
export function toOverviewRow(employee) {
  const assessment = employee.selfAssessments[0];
  return {
    employee: personOf(employee),
    company: companyOf(employee),
    selfAssessmentId: assessment?.status === 'SUBMITTED' ? assessment.id : null,
    status: assessment?.status ?? 'NOT_STARTED',
    submittedAt: assessment?.submittedAt ?? null,
    comments: assessment?.status === 'SUBMITTED' ? assessment.comments : null,
  };
}

export function toGoalSummary(goal) {
  return {
    id: goal.id,
    title: goal.title,
    progressPercent: goal.progressPercent,
    status: goal.status,
    deadline: toDateOnly(goal.deadline),
  };
}