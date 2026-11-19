// The business rules for monthly actual numbers and progress (version 2, Module 13).
//
// Every month, for each KPI of an ACTIVE plan, someone enters the real number (the "actual"),
// and someone else confirms it. Only CONFIRMED numbers count in progress (and, in Module 16, in scores).
//
//                     Enters the actual                      Confirms it
//   Employee plan     the employee (or the Manager)          the Manager (or a Holding approver)
//   Company plan      the Manager (or a Holding approver)    a Holding approver
//   Holding plan      a Holding user                         nobody: it is the top level, so it counts at once
//
// When the person entering may also confirm, the number is confirmed at once.
// Changing a confirmed number takes the confirmation away again (it must be checked again).
//
// Months: numbers can only be entered and confirmed while the month is OPEN. A CLOSED month is frozen,
// and a month cannot be closed while numbers are still waiting for confirmation (plan-year service).
//
// Comments: for each month or quarter, the owner of the plan and the reviewer can each write a comment.
// There is no score here: the score comes once, from the confirmed numbers (Module 16).

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { toDateOnly } from '../../shared/validation.js';
import { assertCanView, isApprover } from '../plans/plan.access.js';
import { periodProgress } from './progress.rules.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));

// ---------- Who may do what ----------

function isCompanyManager(user, plan) {
  return user.role === 'MANAGER' && Boolean(user.companyId) && user.companyId === plan.companyId;
}

export function isOwner(user, plan) {
  if (plan.level === 'INDIVIDUAL') return user.role === 'EMPLOYEE' && user.employeeId === plan.employeeId;
  if (plan.level === 'COMPANY') return isCompanyManager(user, plan);
  return false;
}

export function isReviewer(user, plan) {
  if (plan.level === 'INDIVIDUAL') return isCompanyManager(user, plan) || isApprover(user);
  if (plan.level === 'COMPANY') return user.role === 'HOLDING';
  return false;
}

function isLive(plan) {
  return plan.status === 'ACTIVE' && plan.cycle.status === 'ACTIVE';
}

export function canEnter(user, plan) {
  if (!isLive(plan)) return false;
  if (plan.level === 'HOLDING') return user.role === 'HOLDING';
  if (plan.level === 'COMPANY') return isCompanyManager(user, plan) || isApprover(user);
  return isOwner(user, plan) || isCompanyManager(user, plan);
}

export function canConfirm(user, plan) {
  if (!isLive(plan)) return false;
  if (plan.level === 'HOLDING') return user.role === 'HOLDING';
  if (plan.level === 'COMPANY') return isApprover(user);
  return isCompanyManager(user, plan) || isApprover(user);
}

// ---------- Loading ----------

const progressInclude = {
  cycle: true,
  company: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  kpis: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      months: {
        include: { enteredBy: { select: { email: true } }, confirmedBy: { select: { email: true } } },
      },
    },
  },
  reviews: { include: { reviewer: { select: { email: true } } } },
};

async function loadPlan(planId, db = prisma) {
  const plan = await db.plan.findUnique({ where: { id: planId }, include: progressInclude });
  if (!plan) throw AppError.notFound('Plan not found.');
  return plan;
}

function loadPeriods(cycleId, db = prisma) {
  return db.evaluationPeriod.findMany({ where: { cycleId }, orderBy: [{ startDate: 'asc' }, { sequence: 'asc' }] });
}

// The KPI and month a number belongs to, with every check the two "write" actions share.
async function loadKpiMonth(kpiId, periodId, tx) {
  const kpi = await tx.kpi.findUnique({ where: { id: kpiId }, include: { plan: { include: { cycle: true } } } });
  if (!kpi) throw AppError.notFound('KPI not found.');
  const row = await tx.kpiMonth.findUnique({ where: { kpiId_periodId: { kpiId, periodId } }, include: { period: true } });
  if (!row) throw AppError.notFound('This month is not part of the KPI\'s plan year.');
  return { kpi, plan: kpi.plan, row };
}

function assertMonthOpen(plan, period) {
  if (plan.status !== 'ACTIVE') throw AppError.conflict('Numbers can only be entered for an active plan.');
  if (plan.cycle.status !== 'ACTIVE') throw AppError.conflict('Numbers can only be entered while the plan year is active.');
  if (period.status === 'UPCOMING') throw AppError.conflict('This month has not been opened yet.');
  if (period.status === 'CLOSED') throw AppError.conflict('This month is closed: its numbers can no longer change.');
}

// ---------- Reading: the progress of a plan ----------

export async function getProgress(planId, user) {
  const plan = await loadPlan(planId);
  assertCanView(user, plan);
  const periods = await loadPeriods(plan.cycleId);
  const months = periods.filter((p) => p.type === 'MONTH');
  const groups = periods.filter((p) => p.type !== 'MONTH');
  const cap = plan.cycle.achievementCap;

  // Which months belong to each quarter, half and the year.
  const childrenOf = (id) => periods.filter((p) => p.parentId === id);
  const monthsOf = (period) => (period.type === 'MONTH' ? [period] : childrenOf(period.id).flatMap(monthsOf));

  let waiting = 0;
  const kpis = plan.kpis.map((kpi) => {
    const byPeriod = new Map(kpi.months.map((m) => [m.periodId, m]));
    const rows = months.map((period) => {
      const m = byPeriod.get(period.id);
      const state = !m || m.actual === null ? 'EMPTY' : m.confirmedAt ? 'CONFIRMED' : 'ENTERED';
      if (state === 'ENTERED') waiting += 1;
      return {
        periodId: period.id,
        target: num(m?.target),
        actual: num(m?.actual),
        comment: m?.comment ?? null,
        state,
        enteredBy: m?.enteredBy?.email ?? null,
        enteredAt: m?.enteredAt ?? null,
        confirmedBy: m?.confirmedBy?.email ?? null,
        confirmedAt: m?.confirmedAt ?? null,
      };
    });
    const rowById = new Map(rows.map((r) => [r.periodId, r]));
    const summary = Object.fromEntries(
      groups.map((group) => [
        group.id,
        periodProgress(
          monthsOf(group).map((month) => {
            const r = rowById.get(month.id);
            return { target: r.target, actual: r.actual, confirmed: r.state === 'CONFIRMED' };
          }),
          kpi,
          cap,
        ),
      ]),
    );
    return {
      id: kpi.id,
      perspective: kpi.perspective,
      name: kpi.name,
      unit: kpi.unit,
      direction: kpi.direction,
      aggregation: kpi.aggregation,
      weight: kpi.weight,
      yearTarget: num(kpi.yearTarget),
      months: rows,
      summary,
    };
  });

  return {
    plan: {
      id: plan.id,
      level: plan.level,
      status: plan.status,
      company: plan.company,
      employee: plan.employee,
      planYear: { id: plan.cycle.id, name: plan.cycle.name, status: plan.cycle.status, achievementCap: cap },
    },
    periods: periods.map((p) => ({
      id: p.id,
      type: p.type,
      sequence: p.sequence,
      name: p.name,
      parentId: p.parentId,
      startDate: toDateOnly(p.startDate),
      endDate: toDateOnly(p.endDate),
      status: p.status,
    })),
    kpis,
    reviews: plan.reviews.map((r) => ({
      periodId: r.periodId,
      ownerComment: r.ownerComment,
      ownerCommentAt: r.ownerCommentAt,
      reviewerComment: r.reviewerComment,
      reviewer: r.reviewer?.email ?? null,
      reviewerCommentAt: r.reviewerCommentAt,
    })),
    waitingForConfirmation: waiting,
    can: {
      enter: canEnter(user, plan),
      confirm: canConfirm(user, plan) && plan.level !== 'HOLDING',
      ownerComment: isOwner(user, plan) && plan.status === 'ACTIVE' && plan.cycle.status !== 'CLOSED',
      reviewerComment: isReviewer(user, plan) && plan.status === 'ACTIVE' && plan.cycle.status !== 'CLOSED',
    },
  };
}

// ---------- Writing: entering and confirming numbers ----------

export async function enterActual(kpiId, periodId, { actual, comment }, user) {
  const planId = await prisma.$transaction(async (tx) => {
    const { kpi, plan, row } = await loadKpiMonth(kpiId, periodId, tx);
    assertCanView(user, plan);
    if (!canEnter(user, plan)) {
      assertMonthOpen(plan, row.period);
      throw AppError.forbidden('You cannot enter numbers for this plan.');
    }
    assertMonthOpen(plan, row.period);

    // The person who may confirm confirms at once. Anybody else's new number must be checked again.
    const confirmNow = canConfirm(user, plan);
    const before = num(row.actual);
    const after = await tx.kpiMonth.update({
      where: { id: row.id },
      data: {
        actual,
        comment: comment ?? null,
        enteredById: user.id,
        enteredAt: new Date(),
        confirmedById: confirmNow ? user.id : null,
        confirmedAt: confirmNow ? new Date() : null,
      },
    });
    await recordAudit(
      {
        userId: user.id,
        action: 'ACTUAL_ENTERED',
        entityType: 'Kpi',
        entityId: kpiId,
        details: { kpi: kpi.name, month: row.period.name, from: before, to: num(after.actual), confirmed: confirmNow },
      },
      tx,
    );
    return plan.id;
  });
  return getProgress(planId, user);
}

export async function confirmActual(kpiId, periodId, user) {
  const planId = await prisma.$transaction(async (tx) => {
    const { kpi, plan, row } = await loadKpiMonth(kpiId, periodId, tx);
    assertCanView(user, plan);
    if (!canConfirm(user, plan)) {
      throw AppError.forbidden(plan.level === 'COMPANY' ? 'Company numbers are confirmed by the Holding.' : 'Only the Manager (or a Holding approver) can confirm these numbers.');
    }
    assertMonthOpen(plan, row.period);
    if (row.actual === null) throw AppError.conflict('There is no number to confirm yet.');
    const { count } = await tx.kpiMonth.updateMany({
      where: { id: row.id, confirmedAt: null, actual: { not: null } },
      data: { confirmedById: user.id, confirmedAt: new Date() },
    });
    if (count === 0) throw AppError.conflict('This number is already confirmed.');
    await recordAudit(
      { userId: user.id, action: 'ACTUAL_CONFIRMED', entityType: 'Kpi', entityId: kpiId, details: { kpi: kpi.name, month: row.period.name, actual: num(row.actual) } },
      tx,
    );
    return plan.id;
  });
  return getProgress(planId, user);
}

// Confirms every number of one month of a plan that is waiting, in one click.
export async function confirmMonth(planId, periodId, user) {
  await prisma.$transaction(async (tx) => {
    const plan = await loadPlan(planId, tx);
    assertCanView(user, plan);
    if (!canConfirm(user, plan)) throw AppError.forbidden('You cannot confirm the numbers of this plan.');
    const period = await tx.evaluationPeriod.findFirst({ where: { id: periodId, cycleId: plan.cycleId, type: 'MONTH' } });
    if (!period) throw AppError.notFound('Month not found in this plan year.');
    assertMonthOpen(plan, period);
    const { count } = await tx.kpiMonth.updateMany({
      where: { periodId, kpi: { planId }, actual: { not: null }, confirmedAt: null },
      data: { confirmedById: user.id, confirmedAt: new Date() },
    });
    if (count === 0) throw AppError.conflict('No numbers of this month are waiting for confirmation.');
    await recordAudit({ userId: user.id, action: 'ACTUALS_CONFIRMED', entityType: 'Plan', entityId: planId, details: { month: period.name, count } }, tx);
  });
  return getProgress(planId, user);
}

// ---------- Writing: comments for a month or a quarter ----------

export async function saveComment(planId, periodId, { comment }, user) {
  await prisma.$transaction(async (tx) => {
    const plan = await loadPlan(planId, tx);
    assertCanView(user, plan);
    if (plan.level === 'HOLDING') throw AppError.conflict('The Holding plan has no progress comments.');
    if (plan.status !== 'ACTIVE') throw AppError.conflict('Comments can only be written on an active plan.');
    if (plan.cycle.status === 'CLOSED') throw AppError.conflict('This plan year is closed.');

    const period = await tx.evaluationPeriod.findFirst({ where: { id: periodId, cycleId: plan.cycleId, type: { in: ['MONTH', 'QUARTER'] } } });
    if (!period) throw AppError.notFound('Month or quarter not found in this plan year.');
    if (period.status === 'UPCOMING') throw AppError.conflict('This period has not started yet.');

    let data;
    if (isOwner(user, plan)) data = { ownerComment: comment, ownerCommentAt: new Date() };
    else if (isReviewer(user, plan)) data = { reviewerComment: comment, reviewerId: user.id, reviewerCommentAt: new Date() };
    else throw AppError.forbidden('Only the owner of the plan and the person who checks it can comment.');

    await tx.progressReview.upsert({
      where: { planId_periodId: { planId, periodId } },
      create: { planId, periodId, ...data },
      update: data,
    });
    await recordAudit(
      { userId: user.id, action: 'PROGRESS_COMMENTED', entityType: 'Plan', entityId: planId, details: { period: period.name, as: data.ownerComment !== undefined ? 'owner' : 'reviewer' } },
      tx,
    );
  });
  return getProgress(planId, user);
}

// ---------- Used by other modules ----------

// Numbers of one month that are entered but not confirmed yet (the month cannot close until 0).
export function countWaitingInMonth(periodId, db = prisma) {
  return db.kpiMonth.count({ where: { periodId, actual: { not: null }, confirmedAt: null } });
}

// How many numbers are waiting for confirmation, per plan (for the plan lists).
export async function waitingPerPlan(planIds, db = prisma) {
  if (planIds.length === 0) return {};
  const rows = await db.kpiMonth.findMany({
    where: { kpi: { planId: { in: planIds } }, actual: { not: null }, confirmedAt: null },
    select: { kpi: { select: { planId: true } } },
  });
  const counts = {};
  for (const row of rows) counts[row.kpi.planId] = (counts[row.kpi.planId] ?? 0) + 1;
  return counts;
}

// Has any actual number been entered in this plan? (Then it cannot be deleted.)
export function countActualsInPlan(planId, db = prisma) {
  return db.kpiMonth.count({ where: { kpi: { planId }, actual: { not: null } } });
}
