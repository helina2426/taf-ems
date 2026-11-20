// Version 2 reports and dashboards (Module 19): the plan year.
//
//   GET /reports/plan-year   (Holding: every company, or one with ?companyId=; Manager: their own company only)
//     • per company: the company plan's KPIs, year to date and per quarter, with traffic lights
//     • per employee: their plan, how many KPIs are green / yellow / red, and the lists
//       on track (all green) · at risk (worst is yellow) · off track (at least one red)
//     • employees with no plan yet, and numbers waiting for confirmation
//     • the ratings of published plan-based evaluations (mid-year and annual), per company
//
//   The dashboards (report.service.js) add a "v2" block built from the same data.
//
// Only CONFIRMED monthly numbers count, exactly like the progress page and the evaluation scores
// (periodProgress in progress.rules.js). The company wall: a Manager's company always comes from
// req.user, never from the URL.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { toDateOnly } from '../../shared/validation.js';
import { evaluationKind } from '../evaluations/evaluation.v2.js';
import { mondayOf } from '../check-ins/checkIn.rules.js';
import { todayInAddis } from '../plan-years/planYear.service.js';
import { periodProgress } from '../progress/progress.rules.js';
import { EVALUABLE_STATUSES } from './report.repository.js';
import { choosePlanYear, ratingDistribution, summarizeLights } from './report.v2.rules.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));
const person = (e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle });

// ---------- Loading ----------

async function loadPlanYear(planYearId) {
  const cycles = await prisma.performanceCycle.findMany({ orderBy: { startDate: 'desc' } });
  const cycle = choosePlanYear(cycles, todayInAddis(), planYearId);
  if (planYearId && !cycle) throw AppError.notFound('Plan year not found.');
  return { cycle, cycles };
}

function loadPeriods(cycleId) {
  return prisma.evaluationPeriod.findMany({
    where: { cycleId, type: { in: ['MONTH', 'QUARTER'] } },
    orderBy: [{ startDate: 'asc' }, { sequence: 'asc' }],
  });
}

function loadPlans(cycleId, companyId) {
  return prisma.plan.findMany({
    where: { cycleId, level: { in: ['COMPANY', 'INDIVIDUAL'] }, ...(companyId && { companyId }) },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      kpis: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { months: { select: { periodId: true, target: true, actual: true, confirmedAt: true } } },
      },
    },
  });
}

// ---------- Calculating ----------

// One KPI: year to date and each quarter.
function kpiProgress(kpi, months, quarters, cap) {
  const byPeriod = new Map(kpi.months.map((m) => [m.periodId, m]));
  const row = (month) => {
    const m = byPeriod.get(month.id);
    return { target: num(m?.target) ?? 0, actual: num(m?.actual), confirmed: Boolean(m?.confirmedAt) };
  };
  const ytd = periodProgress(months.map(row), kpi, cap);
  let waiting = 0;
  for (const m of kpi.months) if (m.actual !== null && !m.confirmedAt) waiting += 1;
  return {
    id: kpi.id,
    name: kpi.name,
    unit: kpi.unit,
    weight: kpi.weight,
    yearTarget: num(kpi.yearTarget),
    yearToDate: { targetSoFar: ytd.targetSoFar, actual: ytd.actual, achievement: ytd.achievement, light: ytd.light, monthsKnown: ytd.monthsKnown },
    quarters: quarters.map((q) => {
      const p = periodProgress(months.filter((m) => m.startDate >= q.startDate && m.endDate <= q.endDate).map(row), kpi, cap);
      return { periodId: q.id, achievement: p.achievement, light: p.light };
    }),
    waiting,
  };
}

function planProgress(plan, months, quarters, cap) {
  const kpis = plan.status === 'ACTIVE' ? plan.kpis.map((k) => kpiProgress(k, months, quarters, cap)) : [];
  return {
    id: plan.id,
    status: plan.status,
    kpis,
    lights: summarizeLights(kpis.map((k) => k.yearToDate.light)),
    waiting: kpis.reduce((sum, k) => sum + k.waiting, 0),
  };
}

// Everything about one plan year (and one company, or all of them).
export async function buildPlanYear(cycle, companyId) {
  const [periods, plans, companies, employees, evaluations] = await Promise.all([
    loadPeriods(cycle.id),
    loadPlans(cycle.id, companyId),
    prisma.company.findMany({ where: companyId ? { id: companyId } : { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.employee.findMany({
      where: { employmentStatus: { in: EVALUABLE_STATUSES }, user: { role: 'EMPLOYEE' }, ...(companyId && { companyId }) },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, companyId: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.evaluation.findMany({
      where: { status: 'PUBLISHED', rating: { not: null }, period: { cycleId: cycle.id }, ...(companyId && { companyId }) },
      select: { rating: true, type: true, companyId: true, period: { select: { cycleId: true, type: true, sequence: true } } },
    }),
  ]);
  const months = periods.filter((p) => p.type === 'MONTH');
  const quarters = periods.filter((p) => p.type === 'QUARTER');
  const cap = cycle.achievementCap;

  const companyPlans = new Map();
  const employeePlans = new Map();
  for (const plan of plans) {
    if (plan.level === 'COMPANY') companyPlans.set(plan.companyId, plan);
    else employeePlans.set(plan.employeeId, plan);
  }
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  // One row per employee who should have a plan.
  const people = employees.map((e) => {
    const plan = employeePlans.get(e.id);
    const progress = plan ? planProgress(plan, months, quarters, cap) : null;
    return {
      employee: person(e),
      company: { id: e.companyId, name: companyName.get(e.companyId) ?? '' },
      plan: progress && { id: progress.id, status: progress.status, kpiCount: plan.kpis.length, lights: progress.lights, waiting: progress.waiting },
    };
  });
  const active = people.filter((p) => p.plan?.status === 'ACTIVE');
  const lists = {
    onTrack: active.filter((p) => p.plan.lights.worst === 'GREEN'),
    atRisk: active.filter((p) => p.plan.lights.worst === 'YELLOW'),
    offTrack: active.filter((p) => p.plan.lights.worst === 'RED'),
    noNumbersYet: active.filter((p) => p.plan.lights.worst === null),
  };

  const ratingsOf = (rows) => ratingDistribution(rows.map((r) => r.rating));
  const companyRows = companies.map((company) => {
    const plan = companyPlans.get(company.id);
    const progress = plan ? planProgress(plan, months, quarters, cap) : null;
    const mine = people.filter((p) => p.company.id === company.id);
    const mineActive = mine.filter((p) => p.plan?.status === 'ACTIVE');
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      companyPlan: progress,
      employees: {
        total: mine.length,
        activePlans: mineActive.length,
        plansInProgress: mine.filter((p) => p.plan && p.plan.status !== 'ACTIVE').length,
        withoutPlan: mine.filter((p) => !p.plan).length,
        onTrack: mineActive.filter((p) => p.plan.lights.worst === 'GREEN').length,
        atRisk: mineActive.filter((p) => p.plan.lights.worst === 'YELLOW').length,
        offTrack: mineActive.filter((p) => p.plan.lights.worst === 'RED').length,
      },
      waitingForConfirmation: (progress?.waiting ?? 0) + mineActive.reduce((sum, p) => sum + p.plan.waiting, 0),
      ratings: ratingsOf(evaluations.filter((e) => e.companyId === company.id)),
    };
  });

  return {
    planYear: { id: cycle.id, name: cycle.name, status: cycle.status, startDate: toDateOnly(cycle.startDate), endDate: toDateOnly(cycle.endDate), achievementCap: cap },
    quarters: quarters.map((q) => ({ id: q.id, sequence: q.sequence, name: q.name, status: q.status, startDate: toDateOnly(q.startDate), endDate: toDateOnly(q.endDate) })),
    companies: companyRows,
    employees: people,
    lists,
    withoutPlan: people.filter((p) => !p.plan),
    waitingForConfirmation: companyRows.reduce((sum, c) => sum + c.waitingForConfirmation, 0),
    ratings: {
      all: ratingsOf(evaluations),
      midYear: ratingsOf(evaluations.filter((e) => evaluationKind(e.period) === 'MID_YEAR')),
      annual: ratingsOf(evaluations.filter((e) => evaluationKind(e.period) === 'ANNUAL')),
      employees: ratingsOf(evaluations.filter((e) => e.type === 'EMPLOYEE')),
      managers: ratingsOf(evaluations.filter((e) => e.type === 'MANAGER')),
    },
  };
}

// ---------- GET /reports/plan-year ----------

export async function planYearReport({ planYearId, companyId }, user) {
  let scope = companyId;
  if (user.role === 'MANAGER') {
    if (!user.companyId) throw AppError.forbidden('You are not assigned to a company yet.');
    // The company wall: a Manager asking for another company gets 403, not a quiet switch.
    if (companyId && companyId !== user.companyId) throw AppError.forbidden('You can only see the reports of your own company.');
    scope = user.companyId;
  } else if (companyId && !(await prisma.company.findUnique({ where: { id: companyId } }))) {
    throw AppError.notFound('Company not found.');
  }
  const { cycle, cycles } = await loadPlanYear(planYearId);
  const planYears = cycles.map((c) => ({ id: c.id, name: c.name, status: c.status }));
  if (!cycle) return { planYear: null, planYears };
  return { ...(await buildPlanYear(cycle, scope)), planYears };
}

// ---------- The "v2" block of the dashboards ----------

const short = (p) => ({ employee: p.employee, planId: p.plan.id, lights: p.plan.lights });

export async function holdingV2() {
  const { cycle } = await loadPlanYear();
  if (!cycle) return null;
  const report = await buildPlanYear(cycle);
  const [companyPlansWaiting, targetChangesWaiting, appealsWaiting] = await Promise.all([
    prisma.plan.count({ where: { cycleId: cycle.id, level: 'COMPANY', status: 'SUBMITTED' } }),
    prisma.kpiChangeRequest.count({ where: { status: 'PENDING' } }),
    prisma.evaluationAppeal.count({ where: { status: 'SUBMITTED' } }),
  ]);
  return {
    planYear: report.planYear,
    companyPlansWaiting,
    targetChangesWaiting,
    appealsWaiting,
    // Numbers of the COMPANY plans waiting for a Holding approver to confirm them.
    companyNumbersWaiting: report.companies.reduce((sum, c) => sum + (c.companyPlan?.waiting ?? 0), 0),
    people: peopleCounts(report),
    companies: report.companies.map((c) => ({ id: c.id, name: c.name, planStatus: c.companyPlan?.status ?? null, lights: c.companyPlan?.lights ?? null })),
    ratings: report.ratings.all,
  };
}

function peopleCounts(report) {
  return {
    total: report.employees.length,
    activePlans: report.employees.filter((p) => p.plan?.status === 'ACTIVE').length,
    withoutPlan: report.withoutPlan.length,
    onTrack: report.lists.onTrack.length,
    atRisk: report.lists.atRisk.length,
    offTrack: report.lists.offTrack.length,
    noNumbersYet: report.lists.noNumbersYet.length,
  };
}

export async function managerV2(user) {
  const { cycle } = await loadPlanYear();
  if (!cycle) return null;
  const companyId = user.companyId;
  const report = await buildPlanYear(cycle, companyId);
  const company = report.companies[0];
  const today = todayInAddis();
  const holding = await prisma.holding.findFirst({ select: { weeklyCheckInsEnabled: true } });
  const weekStart = mondayOf(today);
  const [targetChangesWaiting, checkInsThisWeek, mine] = await Promise.all([
    prisma.kpiChangeRequest.count({ where: { status: 'PENDING', kpi: { plan: { companyId } } } }),
    holding?.weeklyCheckInsEnabled ? prisma.weeklyCheckIn.count({ where: { companyId, weekStart: new Date(`${weekStart}T00:00:00Z`) } }) : null,
    // The Manager's own latest PUBLISHED plan-based evaluation.
    user.employeeId
      ? prisma.evaluation.findFirst({ where: { employeeId: user.employeeId, status: 'PUBLISHED', rating: { not: null } }, include: { period: true }, orderBy: { publishedAt: 'desc' } })
      : null,
  ]);
  const watch = [...report.lists.offTrack, ...report.lists.atRisk].map(short);
  return {
    planYear: report.planYear,
    companyPlan: company?.companyPlan ? { id: company.companyPlan.id, status: company.companyPlan.status, lights: company.companyPlan.lights } : null,
    people: peopleCounts(report),
    planDrafts: company?.employees.plansInProgress ?? 0,
    // Off track first, then at risk: the people the Manager should talk to.
    watchList: watch.slice(0, 8),
    waitingForConfirmation: company?.waitingForConfirmation ?? 0,
    targetChangesWaiting,
    checkIns: checkInsThisWeek === null ? null : { weekStart, written: checkInsThisWeek, team: report.employees.length },
    ratings: report.ratings.all,
    myLatestEvaluation: mine
      ? { id: mine.id, overallScore: num(mine.overallScore), rating: mine.rating, kind: evaluationKind(mine.period), acknowledged: Boolean(mine.acknowledgedAt) }
      : null,
  };
}

export async function employeeV2(user) {
  const { cycle } = await loadPlanYear();
  if (!cycle) return null;
  const plan = await prisma.plan.findFirst({
    where: { cycleId: cycle.id, scope: `EMPLOYEE:${user.employeeId}` },
    include: { kpis: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { months: { select: { periodId: true, target: true, actual: true, confirmedAt: true } } } } },
  });
  const planYear = { id: cycle.id, name: cycle.name, status: cycle.status };
  // The employee sees their plan only once it is ACTIVE (the same rule as the plan page).
  if (!plan || plan.status !== 'ACTIVE') return { planYear, myPlan: null };
  const periods = await loadPeriods(cycle.id);
  const progress = planProgress(plan, periods.filter((p) => p.type === 'MONTH'), [], cycle.achievementCap);
  return {
    planYear,
    myPlan: {
      id: plan.id,
      acknowledged: Boolean(plan.acknowledgedAt),
      lights: progress.lights,
      kpis: progress.kpis.map((k) => ({ id: k.id, name: k.name, unit: k.unit, weight: k.weight, ...k.yearToDate })),
    },
  };
}
