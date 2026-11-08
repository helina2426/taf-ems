// Reports and dashboards (SRS FR-09).
//
// Who sees what (SRS section 3, "View reports"):
//   • Holding users: every company, company comparisons, Manager performance.
//   • Managers: their OWN company only (the company wall), and their own employees.
//   • Employees: only their OWN PUBLISHED results.
//
// Words used in the reports:
//   • final      = APPROVED or PUBLISHED. Only final results count in averages.
//   • not started = an employee who should be evaluated but has no evaluation in the period yet.
//   • completion rate = final evaluations ÷ everybody who should be evaluated, in percent.
//   • on time    = submitted (the last time) before the end of the period's last day.

import { AppError } from '../../shared/AppError.js';
import { toDateOnly } from '../../shared/validation.js';
import * as repository from './report.repository.js';

const STATUSES = ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'PUBLISHED'];

// ---------- Small helpers ----------

const round = (value, decimals = 2) => {
  if (value === null || value === undefined) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
};

// Percentage of part in whole; null when there is nothing to count (avoids dividing by 0).
const percent = (part, whole) => (whole > 0 ? round((part / whole) * 100, 1) : null);

// Turns groupBy rows into a quick lookup: { companyId: count }.
function countsBy(rows, key = 'companyId') {
  return Object.fromEntries(rows.map((row) => [row[key], row._count._all]));
}

// { DRAFT: 0, SUBMITTED: 2, ... } — every status is present, even when it is 0.
function emptyStatusCounts() {
  return Object.fromEntries(STATUSES.map((s) => [s, 0]));
}

function periodSummary(period) {
  return period
    ? { id: period.id, name: period.name, status: period.status, startDate: toDateOnly(period.startDate), endDate: toDateOnly(period.endDate) }
    : null;
}

// The period a report is about: the one asked for; otherwise the most recent OPEN one;
// otherwise the most recent one of all. "required" → 404 when there is none.
async function resolvePeriod(periodId, { required = true } = {}) {
  if (periodId) {
    const period = await repository.findPeriodById(periodId);
    if (!period) throw AppError.notFound('Evaluation period not found.');
    return period;
  }
  const period = (await repository.findLatestOpenPeriod()) ?? (await repository.findLatestPeriod());
  if (!period && required) throw AppError.notFound('There are no evaluation periods yet.');
  return period;
}

function managersCompanyId(user) {
  if (!user.companyId) throw AppError.forbidden('You are not assigned to a company yet.');
  return user.companyId;
}

// ---------- Completion (pending vs completed) ----------

// Builds one row per company with the evaluation counts for the period.
async function buildCompletionRows(period, onlyCompanyId) {
  const [companies, statusRows, notStartedRows] = await Promise.all([
    repository.findCompaniesForPeriod(period.id, onlyCompanyId),
    repository.countEvaluationsByCompanyAndStatus(period.id),
    repository.countNotStartedByCompany(period.id),
  ]);
  const notStarted = countsBy(notStartedRows);

  return companies.map((company) => {
    const byStatus = emptyStatusCounts();
    for (const row of statusRows) {
      if (row.companyId === company.id) byStatus[row.status] = row._count._all;
    }
    const started = STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
    const notStartedCount = notStarted[company.id] ?? 0;
    const toEvaluate = started + notStartedCount;
    const completed = byStatus.APPROVED + byStatus.PUBLISHED;

    return {
      company: { id: company.id, name: company.name, code: company.code, isActive: company.isActive },
      toEvaluate,
      notStarted: notStartedCount,
      inProgress: byStatus.DRAFT + byStatus.RETURNED,
      pendingApproval: byStatus.SUBMITTED,
      completed,
      completionRate: percent(completed, toEvaluate),
      byStatus,
    };
  });
}

function sumRows(rows) {
  const totals = { toEvaluate: 0, notStarted: 0, inProgress: 0, pendingApproval: 0, completed: 0, byStatus: emptyStatusCounts() };
  for (const row of rows) {
    for (const key of ['toEvaluate', 'notStarted', 'inProgress', 'pendingApproval', 'completed']) totals[key] += row[key];
    for (const s of STATUSES) totals.byStatus[s] += row.byStatus[s];
  }
  totals.completionRate = percent(totals.completed, totals.toEvaluate);
  return totals;
}

export async function completionReport({ periodId }, user) {
  const period = await resolvePeriod(periodId);
  // The company wall: a Manager only ever gets their own company's row.
  const onlyCompanyId = user.role === 'MANAGER' ? managersCompanyId(user) : undefined;
  const companies = await buildCompletionRows(period, onlyCompanyId);
  return { period: periodSummary(period), totals: sumRows(companies), companies };
}

// ---------- Company comparison + consolidated Holding report (Holding only) ----------

export async function companyComparison({ periodId }) {
  const period = await resolvePeriod(periodId);
  const [completionRows, statsRows, overall] = await Promise.all([
    buildCompletionRows(period),
    repository.scoreStatsByCompany(period.id),
    repository.overallScoreStats(period.id),
  ]);
  const stats = Object.fromEntries(statsRows.map((row) => [row.companyId, row]));

  const companies = completionRows
    .map((row) => {
      const s = stats[row.company.id];
      return {
        company: row.company,
        evaluated: s?._count._all ?? 0,
        averageScore: round(s?._avg.overallScore),
        highestScore: round(s?._max.overallScore),
        lowestScore: round(s?._min.overallScore),
        completionRate: row.completionRate,
        pendingApproval: row.pendingApproval,
      };
    })
    // Best average first; companies with no final results yet go last.
    .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
    .map((row, index) => ({ rank: row.averageScore === null ? null : index + 1, ...row }));

  const totals = sumRows(completionRows);
  return {
    period: periodSummary(period),
    consolidated: {
      companies: companies.length,
      toEvaluate: totals.toEvaluate,
      evaluated: overall._count._all,
      averageScore: round(overall._avg.overallScore),
      highestScore: round(overall._max.overallScore),
      lowestScore: round(overall._min.overallScore),
      completionRate: totals.completionRate,
      pendingApproval: totals.pendingApproval,
    },
    companies,
  };
}

// ---------- Manager performance (Holding only) ----------
// Measured as proposed in the SRS analysis (question 19): how many of their team's evaluations
// they submitted, how many on time, how often they were returned, and the team's average score.
// Their own (Manager) evaluation result is shown too.

export async function managerPerformance({ periodId }) {
  const period = await resolvePeriod(periodId);

  // "On time" = before midnight at the end of the period's last day.
  const endOfLastDay = new Date(period.endDate.getTime() + 24 * 60 * 60 * 1000);

  const [assignments, completionRows, statsRows, [submittedRows, onTimeRows]] = await Promise.all([
    repository.findActiveAssignments(),
    buildCompletionRows(period),
    repository.scoreStatsByCompany(period.id),
    repository.countSubmittedByCompany(period.id, endOfLastDay),
  ]);
  const completion = Object.fromEntries(completionRows.map((row) => [row.company.id, row]));
  const stats = Object.fromEntries(statsRows.map((row) => [row.companyId, row]));
  const submitted = countsBy(submittedRows);
  const onTime = countsBy(onTimeRows);

  const managers = await Promise.all(
    assignments.map(async (a) => {
      const companyId = a.companyId;
      const row = completion[companyId];
      const submittedCount = submitted[companyId] ?? 0;
      const onTimeCount = onTime[companyId] ?? 0;
      const ownEvaluation = a.manager.employee ? await repository.findEvaluationOf(a.manager.employee.id, period.id) : null;

      return {
        manager: {
          userId: a.manager.id,
          email: a.manager.email,
          firstName: a.manager.employee?.firstName ?? null,
          lastName: a.manager.employee?.lastName ?? null,
          isActive: a.manager.isActive,
        },
        company: { id: a.company.id, name: a.company.name, code: a.company.code },
        managingSince: toDateOnly(a.startDate),
        toEvaluate: row?.toEvaluate ?? 0,
        submitted: submittedCount,
        submissionRate: percent(submittedCount, row?.toEvaluate ?? 0),
        submittedOnTime: onTimeCount,
        onTimeRate: percent(onTimeCount, submittedCount),
        returnedForCorrection: await repository.countReturns(period.id, companyId),
        teamAverageScore: round(stats[companyId]?._avg.overallScore),
        ownEvaluation: ownEvaluation
          ? {
              id: ownEvaluation.id,
              status: ownEvaluation.status,
              overallScore: repository.FINAL_STATUSES.includes(ownEvaluation.status) ? round(ownEvaluation.overallScore) : null,
            }
          : null,
      };
    }),
  );

  return { period: periodSummary(period), managers };
}

// ---------- One employee's performance report (and history) ----------

export async function employeeReport(employeeId, user) {
  const employee = await repository.findEmployeeById(employeeId);
  if (!employee) throw AppError.notFound('Employee not found.');

  const isSelf = employee.user.id === user.id;
  let evaluationFilter;

  if (isSelf) {
    // Everyone sees their own results, but only once published.
    evaluationFilter = { employeeId, status: 'PUBLISHED' };
  } else if (user.role === 'HOLDING') {
    evaluationFilter = { employeeId, status: { in: repository.FINAL_STATUSES } };
  } else if (user.role === 'MANAGER' && employee.companyId === managersCompanyId(user) && employee.user.role === 'EMPLOYEE') {
    // The company wall: only evaluations made in the Manager's own company.
    evaluationFilter = { employeeId, companyId: user.companyId, type: 'EMPLOYEE', status: { in: repository.FINAL_STATUSES } };
  } else {
    throw AppError.forbidden('You do not have access to this employee report.');
  }

  const [evaluations, [goalRows, goalAvg]] = await Promise.all([
    repository.findEvaluationsOfEmployee(evaluationFilter),
    repository.goalStats({ employeeId }),
  ]);

  const history = evaluations.map((e) => ({
    id: e.id,
    period: periodSummary(e.period),
    company: { id: e.company.id, name: e.company.name, code: e.company.code },
    type: e.type,
    status: e.status,
    overallScore: round(e.overallScore),
    publishedAt: e.publishedAt,
    acknowledgedAt: e.acknowledgedAt,
  }));

  const scores = history.map((h) => h.overallScore).filter((s) => s !== null);
  const latest = scores.at(-1) ?? null;
  const previous = scores.at(-2) ?? null;

  const goalsByStatus = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const row of goalRows) goalsByStatus[row.status] = row._count._all;

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      jobTitle: employee.jobTitle,
      employmentStatus: employee.employmentStatus,
      role: employee.user.role,
      company: { id: employee.company.id, name: employee.company.name, code: employee.company.code },
    },
    summary: {
      evaluations: scores.length,
      averageScore: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      latestScore: latest,
      // Positive = better than the previous evaluation, negative = worse.
      changeFromPrevious: latest !== null && previous !== null ? round(latest - previous) : null,
    },
    evaluations: history,
    goals: { byStatus: goalsByStatus, averageProgress: round(goalAvg._avg.progressPercent, 0) },
  };
}

// ---------- Dashboards: one summary per role ----------

async function statusCounts(where) {
  const counts = emptyStatusCounts();
  for (const row of await repository.countEvaluationsByStatus(where)) counts[row.status] = row._count._all;
  return counts;
}

async function holdingDashboard(period, user) {
  const [activeCompanies, employees, managers] = await Promise.all([
    repository.countActiveCompanies(),
    repository.countEvaluableEmployees(),
    repository.countActiveManagers(),
  ]);
  const dashboard = {
    role: 'HOLDING',
    canApproveEvaluations: user.isPrimaryHoldingUser || user.canApproveEvaluations,
    period: periodSummary(period),
    organization: { activeCompanies, employees, managers },
  };
  if (!period) return dashboard;

  const [completion, employeeEvaluations, managerEvaluations, selfAssessmentsSubmitted] = await Promise.all([
    buildCompletionRows(period),
    statusCounts({ periodId: period.id, type: 'EMPLOYEE' }),
    statusCounts({ periodId: period.id, type: 'MANAGER' }),
    repository.countSubmittedSelfAssessments(period.id),
  ]);
  const totals = sumRows(completion);
  dashboard.employeeEvaluations = { ...employeeEvaluations, notStarted: totals.notStarted, completionRate: totals.completionRate };
  dashboard.managerEvaluations = managerEvaluations;
  // What is waiting for an approver right now (employee and Manager evaluations).
  dashboard.waitingForApproval = employeeEvaluations.SUBMITTED + managerEvaluations.SUBMITTED;
  dashboard.waitingForPublication = employeeEvaluations.APPROVED + managerEvaluations.APPROVED;
  dashboard.selfAssessmentsSubmitted = selfAssessmentsSubmitted;
  return dashboard;
}

async function managerDashboard(period, user) {
  const companyId = managersCompanyId(user);
  const company = await repository.findCompanyById(companyId);
  const [teamSize, [goalRows, goalAvg]] = await Promise.all([
    repository.countEvaluableEmployees(companyId),
    repository.goalStats({ employee: { companyId, user: { role: 'EMPLOYEE' } } }),
  ]);
  const goalsByStatus = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const row of goalRows) goalsByStatus[row.status] = row._count._all;

  const dashboard = {
    role: 'MANAGER',
    company: { id: company.id, name: company.name, code: company.code },
    period: periodSummary(period),
    team: { size: teamSize },
    teamGoals: { byStatus: goalsByStatus, averageProgress: round(goalAvg._avg.progressPercent, 0) },
  };
  if (!period) return dashboard;

  const [[row], selfAssessmentsSubmitted, mine] = await Promise.all([
    buildCompletionRows(period, companyId),
    repository.countSubmittedSelfAssessments(period.id, companyId),
    user.employeeId ? repository.findEvaluationOf(user.employeeId, period.id) : null,
  ]);
  dashboard.teamEvaluations = {
    ...row.byStatus,
    notStarted: row.notStarted,
    // RETURNED = sent back to this Manager to fix.
    toFix: row.byStatus.RETURNED,
    completionRate: row.completionRate,
  };
  dashboard.selfAssessmentsSubmitted = selfAssessmentsSubmitted;
  // The Manager's own result: only once it is published (same rule as everywhere else).
  dashboard.myEvaluation =
    mine && mine.status === 'PUBLISHED'
      ? { id: mine.id, overallScore: round(mine.overallScore), acknowledged: Boolean(mine.acknowledgedAt) }
      : null;
  return dashboard;
}

async function employeeDashboard(period, user) {
  const employeeId = user.employeeId;
  if (!employeeId) throw AppError.forbidden('You do not have an employee profile.');

  const [[goalRows, goalAvg], latest, publishedCount, selfAssessment] = await Promise.all([
    repository.goalStats({ employeeId }),
    repository.findLatestPublishedEvaluation(employeeId),
    repository.countPublished(employeeId),
    period ? repository.findSelfAssessment(employeeId, period.id) : null,
  ]);
  const goalsByStatus = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const row of goalRows) goalsByStatus[row.status] = row._count._all;

  return {
    role: 'EMPLOYEE',
    period: periodSummary(period),
    goals: { byStatus: goalsByStatus, averageProgress: round(goalAvg._avg.progressPercent, 0) },
    selfAssessment: period ? (selfAssessment?.status ?? 'NOT_STARTED') : null,
    publishedEvaluations: publishedCount,
    latestEvaluation: latest
      ? {
          id: latest.id,
          period: periodSummary(latest.period),
          overallScore: round(latest.overallScore),
          acknowledged: Boolean(latest.acknowledgedAt),
        }
      : null,
  };
}

export async function dashboard({ periodId }, user) {
  // The dashboard still works when no period exists yet (period is then null).
  const period = await resolvePeriod(periodId, { required: false });
  if (user.role === 'HOLDING') return holdingDashboard(period, user);
  if (user.role === 'MANAGER') return managerDashboard(period, user);
  return employeeDashboard(period, user);
}
