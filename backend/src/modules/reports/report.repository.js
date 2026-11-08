// Database queries for reports.
//
// Reports summarise MANY rows. Instead of loading every evaluation into JavaScript and
// counting there, we ask PostgreSQL to do the counting and averaging (groupBy, aggregate, count).
// The database is built for this, so reports stay fast as the data grows (SRS: performance).

import prisma from '../../config/prisma.js';

// Only these results are "final" and count in averages: approved (and possibly published).
export const FINAL_STATUSES = ['APPROVED', 'PUBLISHED'];
// Only these employees are expected to be evaluated.
export const EVALUABLE_STATUSES = ['ACTIVE', 'ON_LEAVE'];

// ---------- Periods ----------

export function findPeriodById(id) {
  return prisma.evaluationPeriod.findUnique({ where: { id } });
}

export function findLatestOpenPeriod() {
  return prisma.evaluationPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] });
}

export function findLatestPeriod() {
  return prisma.evaluationPeriod.findFirst({ orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }] });
}

// ---------- Companies ----------

// Active companies, plus inactive ones that still have evaluations in this period
// (so a deactivated company's old results do not disappear from the report).
export function findCompaniesForPeriod(periodId, onlyCompanyId) {
  return prisma.company.findMany({
    where: {
      ...(onlyCompanyId && { id: onlyCompanyId }),
      OR: [{ isActive: true }, { evaluations: { some: { periodId } } }],
    },
    orderBy: { name: 'asc' },
  });
}

export function findCompanyById(id) {
  return prisma.company.findUnique({ where: { id } });
}

// ---------- Counting ----------

// How many employee evaluations each company has in each status, for one period.
// Result rows look like: { companyId, status, _count: { _all: 3 } }
export function countEvaluationsByCompanyAndStatus(periodId, type = 'EMPLOYEE') {
  return prisma.evaluation.groupBy({
    by: ['companyId', 'status'],
    where: { periodId, type },
    _count: { _all: true },
  });
}

// Employees (not Managers) who should be evaluated but have NO evaluation in this period yet.
export function countNotStartedByCompany(periodId) {
  return prisma.employee.groupBy({
    by: ['companyId'],
    where: {
      employmentStatus: { in: EVALUABLE_STATUSES },
      user: { role: 'EMPLOYEE' },
      evaluations: { none: { periodId } },
    },
    _count: { _all: true },
  });
}

// Employees (not Managers) who should be evaluated, per company (the "team size").
export function countEvaluableByCompany() {
  return prisma.employee.groupBy({
    by: ['companyId'],
    where: { employmentStatus: { in: EVALUABLE_STATUSES }, user: { role: 'EMPLOYEE' } },
    _count: { _all: true },
  });
}

// Average, highest and lowest FINAL score per company.
export function scoreStatsByCompany(periodId) {
  return prisma.evaluation.groupBy({
    by: ['companyId'],
    where: { periodId, type: 'EMPLOYEE', status: { in: FINAL_STATUSES } },
    _count: { _all: true },
    _avg: { overallScore: true },
    _max: { overallScore: true },
    _min: { overallScore: true },
  });
}

// The same numbers for all companies together (the consolidated Holding view).
export function overallScoreStats(periodId) {
  return prisma.evaluation.aggregate({
    where: { periodId, type: 'EMPLOYEE', status: { in: FINAL_STATUSES } },
    _count: { _all: true },
    _avg: { overallScore: true },
    _max: { overallScore: true },
    _min: { overallScore: true },
  });
}

// Evaluations submitted at least once, and how many of those were submitted on time.
export function countSubmittedByCompany(periodId, onTimeBefore) {
  const where = { periodId, type: 'EMPLOYEE', submittedAt: { not: null } };
  return Promise.all([
    prisma.evaluation.groupBy({ by: ['companyId'], where, _count: { _all: true } }),
    prisma.evaluation.groupBy({
      by: ['companyId'],
      where: { ...where, submittedAt: { lt: onTimeBefore } },
      _count: { _all: true },
    }),
  ]);
}

// How many times evaluations of one company were returned for correction in this period.
export function countReturns(periodId, companyId) {
  return prisma.evaluationReview.count({
    where: { decision: 'RETURNED', evaluation: { periodId, companyId, type: 'EMPLOYEE' } },
  });
}

// ---------- Managers ----------

export function findActiveAssignments(onlyCompanyId) {
  return prisma.managerAssignment.findMany({
    where: { endDate: null, ...(onlyCompanyId && { companyId: onlyCompanyId }) },
    include: { company: true, manager: { include: { employee: true } } },
    orderBy: { company: { name: 'asc' } },
  });
}

export function findEvaluationOf(employeeId, periodId) {
  return prisma.evaluation.findUnique({ where: { employeeId_periodId: { employeeId, periodId } } });
}

// ---------- One employee ----------

export function findEmployeeById(id) {
  return prisma.employee.findUnique({ where: { id }, include: { company: true, user: { select: { id: true, role: true } } } });
}

export function findEvaluationsOfEmployee(where) {
  return prisma.evaluation.findMany({
    where,
    include: { period: true, company: true },
    orderBy: [{ period: { startDate: 'asc' } }, { createdAt: 'asc' }],
  });
}

export function goalStats(where) {
  return Promise.all([
    prisma.performanceGoal.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.performanceGoal.aggregate({ where: { ...where, status: { not: 'CANCELLED' } }, _avg: { progressPercent: true } }),
  ]);
}

// ---------- Dashboard counters ----------

export function countActiveCompanies() {
  return prisma.company.count({ where: { isActive: true } });
}

export function countEvaluableEmployees(companyId) {
  return prisma.employee.count({
    where: { employmentStatus: { in: EVALUABLE_STATUSES }, user: { role: 'EMPLOYEE' }, ...(companyId && { companyId }) },
  });
}

export function countActiveManagers() {
  return prisma.managerAssignment.count({ where: { endDate: null } });
}

export function countEvaluationsByStatus(where) {
  return prisma.evaluation.groupBy({ by: ['status'], where, _count: { _all: true } });
}

export function countSubmittedSelfAssessments(periodId, companyId) {
  return prisma.selfAssessment.count({
    where: { periodId, status: 'SUBMITTED', ...(companyId && { employee: { companyId, user: { role: 'EMPLOYEE' } } }) },
  });
}

export function findSelfAssessment(employeeId, periodId) {
  return prisma.selfAssessment.findUnique({ where: { employeeId_periodId: { employeeId, periodId } } });
}

export function findLatestPublishedEvaluation(employeeId) {
  return prisma.evaluation.findFirst({
    where: { employeeId, status: 'PUBLISHED' },
    include: { period: true },
    orderBy: { publishedAt: 'desc' },
  });
}

export function countPublished(employeeId) {
  return prisma.evaluation.count({ where: { employeeId, status: 'PUBLISHED' } });
}
