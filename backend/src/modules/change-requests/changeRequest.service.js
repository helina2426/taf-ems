// The business rules for target changes during the year (version 2, Module 17).
//
// Once a plan is ACTIVE its KPIs are frozen. But real life changes: a new truck arrives, a station
// closes for repairs. Then the year target of a KPI can be changed — with a REASON, and checked:
//
//                    Asks                         Decides
//   Employee KPI     the company's Manager        the Head (or a Holding approver): approve or reject
//   Company KPI      —                            the Head changes it directly
//   Holding KPI      —                            the Head changes it directly
//   (When the Head makes the change, the request is saved as APPROVED at once, for the history.)
//
//   • Months that are over or closed keep their target; the new year target is shared by the
//     current and future months (changeRequest.rules.js).
//   • Only one request per KPI can wait at a time.
//   • oldValues / newValues keep the year target and the 12 monthly targets, before and after.
//   • Every request and decision is in the audit log.
//   • Evaluations that are still being written use the new targets at once (they are calculated
//     live); submitted evaluations keep the numbers they were submitted with.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { toDateOnly } from '../../shared/validation.js';
import { todayInAddis } from '../plan-years/planYear.service.js';
import { assertCanView, canChangeTargets, isApprover } from '../plans/plan.access.js';
import { isLocked, resplitTargets } from './changeRequest.rules.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));

const requestInclude = {
  requestedBy: { select: { email: true } },
  decidedBy: { select: { email: true } },
  kpi: {
    select: {
      id: true,
      name: true,
      unit: true,
      plan: {
        select: {
          id: true,
          level: true,
          companyId: true,
          employeeId: true,
          status: true,
          company: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  },
};

async function loadKpi(kpiId, tx) {
  const kpi = await tx.kpi.findUnique({
    where: { id: kpiId },
    include: { plan: { include: { cycle: true } }, months: { include: { period: true }, orderBy: { period: { sequence: 'asc' } } } },
  });
  if (!kpi) throw AppError.notFound('KPI not found.');
  return kpi;
}

// The new 12 monthly targets for a new year target, from today's point of view.
function planChange(kpi, yearTarget) {
  const today = todayInAddis();
  const months = kpi.months.map((m) => ({
    target: num(m.target),
    locked: isLocked({ status: m.period.status, endDate: toDateOnly(m.period.endDate) }, today),
  }));
  const result = resplitTargets(months, yearTarget, kpi);
  if (result.error) return result;
  return {
    oldValues: { yearTarget: num(kpi.yearTarget), months: months.map((m) => m.target) },
    newValues: { yearTarget, months: result.targets, changedMonths: result.changedMonths },
  };
}

async function applyChange(kpi, newValues, tx) {
  await tx.kpi.update({ where: { id: kpi.id }, data: { yearTarget: newValues.yearTarget } });
  for (const [i, month] of kpi.months.entries()) {
    if (num(month.target) !== newValues.months[i]) {
      await tx.kpiMonth.update({ where: { kpiId_periodId: { kpiId: kpi.id, periodId: month.periodId } }, data: { target: newValues.months[i] } });
    }
  }
}

function toResponse(request, user) {
  const plan = request.kpi.plan;
  const oldMonths = request.oldValues.months ?? [];
  const newMonths = request.newValues.months ?? [];
  return {
    id: request.id,
    status: request.status,
    reason: request.reason,
    kpi: { id: request.kpi.id, name: request.kpi.name, unit: request.kpi.unit },
    plan: {
      id: plan.id,
      level: plan.level,
      company: plan.company,
      employee: plan.employee,
    },
    oldYearTarget: request.oldValues.yearTarget,
    newYearTarget: request.newValues.yearTarget,
    // The months whose target changes: their number (1–12), before and after.
    changedMonths: newMonths
      .map((target, i) => ({ month: i + 1, from: oldMonths[i], to: target }))
      .filter((m) => m.from !== m.to),
    requestedBy: request.requestedBy.email,
    createdAt: request.createdAt,
    decidedBy: request.decidedBy?.email ?? null,
    decidedAt: request.decidedAt,
    decisionComment: request.decisionComment,
    can: { decide: request.status === 'PENDING' && isApprover(user) },
  };
}

// ---------- Ask for (or make) a change ----------

export async function createRequest(kpiId, { yearTarget, reason }, user) {
  const request = await prisma.$transaction(async (tx) => {
    const kpi = await loadKpi(kpiId, tx);
    const plan = kpi.plan;
    assertCanView(user, plan);
    if (plan.status !== 'ACTIVE') throw AppError.conflict('Targets are changed like this only in an ACTIVE plan. A draft plan can simply be edited.');
    if (plan.cycle.status !== 'ACTIVE') throw AppError.conflict(`The plan year ${plan.cycle.name} is ${plan.cycle.status}.`);
    if (!canChangeTargets(user, plan)) {
      throw AppError.forbidden(
        plan.level === 'INDIVIDUAL'
          ? "Only the employee's Manager can ask to change this target."
          : 'Only the Head (or a Holding approver) can change the targets of the company and Holding plans.',
      );
    }
    if (await tx.kpiChangeRequest.findFirst({ where: { kpiId, status: 'PENDING' } })) {
      throw AppError.conflict('A change of this target is already waiting for a decision.');
    }
    if (yearTarget === num(kpi.yearTarget)) {
      throw AppError.badRequest('Some fields are missing or invalid.', [{ field: 'yearTarget', message: 'The new target is the same as the current one.' }]);
    }

    const change = planChange(kpi, yearTarget);
    if (change.error) throw AppError.badRequest('Some fields are missing or invalid.', [{ field: 'yearTarget', message: change.error }]);

    // The Head (an approver) changes it at once; a Manager's request waits for the Head.
    const direct = isApprover(user);
    const created = await tx.kpiChangeRequest.create({
      data: {
        kpiId,
        requestedById: user.id,
        reason,
        oldValues: change.oldValues,
        newValues: change.newValues,
        status: direct ? 'APPROVED' : 'PENDING',
        ...(direct && { decidedById: user.id, decidedAt: new Date() }),
      },
      include: requestInclude,
    });
    if (direct) await applyChange(kpi, change.newValues, tx);

    await recordAudit(
      {
        userId: user.id,
        action: direct ? 'KPI_TARGET_CHANGED' : 'KPI_CHANGE_REQUESTED',
        entityType: 'KpiChangeRequest',
        entityId: created.id,
        details: { kpiId, from: change.oldValues.yearTarget, to: yearTarget, reason },
      },
      tx,
    );
    return created;
  });
  return toResponse(request, user);
}

// ---------- The Head decides ----------

async function loadPending(id, user, tx) {
  if (!isApprover(user)) throw AppError.forbidden('Only the Head (or a Holding approver) decides target changes.');
  const request = await tx.kpiChangeRequest.findUnique({ where: { id }, include: requestInclude });
  if (!request) throw AppError.notFound('Change request not found.');
  if (request.status !== 'PENDING') throw AppError.conflict(`This request was already ${request.status.toLowerCase()}.`);
  return request;
}

// Only if it is still PENDING (two approvers clicking at once: the second one gets 409).
async function decide(id, data, tx) {
  const { count } = await tx.kpiChangeRequest.updateMany({ where: { id, status: 'PENDING' }, data });
  if (count === 0) throw AppError.conflict('This request was just decided by someone else.');
}

export async function approveRequest(id, { comment }, user) {
  const request = await prisma.$transaction(async (tx) => {
    const current = await loadPending(id, user, tx);
    const kpi = await loadKpi(current.kpiId, tx);
    if (kpi.plan.status !== 'ACTIVE' || kpi.plan.cycle.status !== 'ACTIVE') throw AppError.conflict('The plan or its plan year is no longer active.');

    // Calculated again: a month may have ended since the request was made.
    const change = planChange(kpi, current.newValues.yearTarget);
    if (change.error) throw AppError.conflict(change.error);

    await decide(id, { status: 'APPROVED', decidedById: user.id, decidedAt: new Date(), decisionComment: comment ?? null, oldValues: change.oldValues, newValues: change.newValues }, tx);
    await applyChange(kpi, change.newValues, tx);
    await recordAudit(
      { userId: user.id, action: 'KPI_CHANGE_APPROVED', entityType: 'KpiChangeRequest', entityId: id, details: { kpiId: kpi.id, from: change.oldValues.yearTarget, to: change.newValues.yearTarget, comment: comment ?? null } },
      tx,
    );
    return tx.kpiChangeRequest.findUnique({ where: { id }, include: requestInclude });
  });
  return toResponse(request, user);
}

export async function rejectRequest(id, { comment }, user) {
  const request = await prisma.$transaction(async (tx) => {
    const current = await loadPending(id, user, tx);
    await decide(id, { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), decisionComment: comment }, tx);
    await recordAudit(
      { userId: user.id, action: 'KPI_CHANGE_REJECTED', entityType: 'KpiChangeRequest', entityId: id, details: { kpiId: current.kpiId, comment } },
      tx,
    );
    return tx.kpiChangeRequest.findUnique({ where: { id }, include: requestInclude });
  });
  return toResponse(request, user);
}

// ---------- Reading ----------

export async function listRequests({ status, planId, kpiId }, user) {
  // Who sees which requests: the Holding all; a Manager their company's; an employee those of their own plan.
  let scope = {};
  if (user.role === 'MANAGER') scope = { kpi: { plan: { companyId: user.companyId ?? '00000000-0000-0000-0000-000000000000' } } };
  if (user.role === 'EMPLOYEE') scope = { kpi: { plan: { employeeId: user.employeeId ?? '00000000-0000-0000-0000-000000000000', status: 'ACTIVE' } } };

  const where = {
    AND: [scope, { ...(status && { status }), ...(kpiId && { kpiId }), ...(planId && { kpi: { planId } }) }],
  };
  const items = await prisma.kpiChangeRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  return { items: items.map((r) => toResponse(r, user)), waiting: items.filter((r) => r.status === 'PENDING').length };
}
