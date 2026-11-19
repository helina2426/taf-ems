// The business rules for plans (version 2, Module 12).
//
// Three levels, in the hierarchy order Holding → Manager → Employee:
//   HOLDING     the group's targets, written by Holding users, activated by the Head (or an approver)
//   COMPANY     the company's targets = the Manager's own plan. Each KPI links to a Holding KPI.
//               DRAFT → SUBMITTED → ACTIVE (approved), or → RETURNED with a reason, then fixed and sent again
//   INDIVIDUAL  one employee's targets. Each KPI links to a KPI of the company plan.
//               DRAFT → ACTIVE (activated by the Manager) → the employee acknowledges it
//
// Order rules (so the hierarchy is always complete):
//   • A company plan can only be submitted once the Holding plan is ACTIVE.
//   • An employee plan can only be activated once the company plan is ACTIVE.
// An ACTIVE plan cannot be changed (Module 17 adds change requests). Only the primary Holding user
// can delete an ACTIVE plan, and only while no KPI of the level below is linked to it.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { addDays } from '../../shared/ethiopianCalendar.js';
import { toDateOnly } from '../../shared/validation.js';
import { EDITABLE, allowedActions, assertCanView, canSeeLinked, isApprover, isWriter } from './plan.access.js';
import { PERSPECTIVES, cascadeWarning, checkPlanReady, resultsShareFor } from './plan.rules.js';
import * as repository from './plan.repository.js';
import { countActualsInPlan, waitingPerPlan } from '../progress/progress.service.js';

const RULE_FIELDS = ['employeeResultsShare', 'managerResultsShare', 'minKpis', 'maxKpis', 'minKpiWeight', 'maxKpiWeight'];

export async function getPlanOrFail(id, db) {
  const plan = await repository.findPlanById(id, db);
  if (!plan) throw AppError.notFound('Plan not found.');
  return plan;
}

function rulesOf(cycle) {
  return Object.fromEntries(RULE_FIELDS.map((field) => [field, cycle[field]]));
}

// The full plan, as this user may see it.
export function toPlanDetail(plan, user) {
  const rules = rulesOf(plan.cycle);
  const showLinked = canSeeLinked(user, plan);
  const kpis = plan.kpis.map((kpi) => {
    const response = repository.toKpiResponse(kpi, { showLinked });
    return { ...response, warning: response.linkedKpis ? cascadeWarning(response, response.linkedKpis) : null };
  });
  const problems = checkPlanReady(plan.level, plan.kpis, rules);
  const actions = allowedActions(user, plan);
  const hasLinked = plan.kpis.some((kpi) => kpi.childKpis.length > 0); // then it cannot be deleted

  return {
    ...repository.toPlanSummary(plan),
    planYear: {
      id: plan.cycle.id,
      name: plan.cycle.name,
      status: plan.cycle.status,
      calendar: plan.cycle.calendar,
      startDate: toDateOnly(plan.cycle.startDate),
      endDate: toDateOnly(plan.cycle.endDate),
    },
    // Plans should be signed within the first days of the year (a reminder, not a block).
    signDeadline: addDays(toDateOnly(plan.cycle.startDate), plan.cycle.planDeadlineDays),
    rules: {
      resultsShare: resultsShareFor(plan.level, rules),
      minKpis: rules.minKpis,
      maxKpis: rules.maxKpis,
      minKpiWeight: rules.minKpiWeight,
      maxKpiWeight: rules.maxKpiWeight,
    },
    perspectives: Object.fromEntries(PERSPECTIVES.map((p) => [p, plan.kpis.filter((k) => k.perspective === p).length])),
    readiness: { ready: problems.length === 0, problems },
    returnComment: plan.returnComment,
    acknowledgeComment: plan.acknowledgeComment,
    createdBy: plan.createdBy?.email ?? null,
    approvedBy: plan.approvedBy?.email ?? null,
    can: { ...actions, delete: actions.delete && !hasLinked },
    kpis,
  };
}

// ---------- Reading ----------

export async function listPlans(query, user) {
  const where = {
    ...(query.planYearId && { cycleId: query.planYearId }),
    ...(query.level && { level: query.level }),
    ...(query.status && { status: query.status }),
  };

  if (user.role === 'HOLDING') {
    if (query.companyId) where.companyId = query.companyId;
  } else if (user.role === 'MANAGER') {
    // The Holding plan (read only) + everything of their own company. Never another company.
    if (query.companyId && query.companyId !== user.companyId) throw AppError.forbidden();
    where.OR = [{ level: 'HOLDING' }, { companyId: user.companyId ?? '00000000-0000-0000-0000-000000000000' }];
  } else {
    // An employee sees only their own plan, once it is active.
    Object.assign(where, { level: 'INDIVIDUAL', employeeId: user.employeeId ?? '00000000-0000-0000-0000-000000000000', status: 'ACTIVE' });
  }

  const plans = await repository.findPlans(where);
  const waiting = await waitingPerPlan(plans.map((p) => p.id));
  // waitingForConfirmation: actual numbers entered but not confirmed yet (Module 13).
  return { items: plans.map((p) => ({ ...repository.toPlanSummary(p), waitingForConfirmation: waiting[p.id] ?? 0 })) };
}

export async function getPlan(id, user) {
  const plan = await getPlanOrFail(id);
  assertCanView(user, plan);
  return toPlanDetail(plan, user);
}

// ---------- Creating ----------

export async function createPlan({ planYearId, level, employeeId }, user) {
  const plan = await prisma.$transaction(async (tx) => {
    const cycle = await repository.findCycle(planYearId, tx);
    if (!cycle) throw AppError.notFound('Plan year not found.');
    if (cycle.status === 'CLOSED') throw AppError.conflict('This plan year is closed.');

    let data;
    if (level === 'HOLDING') {
      if (user.role !== 'HOLDING') throw AppError.forbidden('Only Holding users write the Holding plan.');
      data = { scope: 'HOLDING' };
    } else if (level === 'COMPANY') {
      if (user.role !== 'MANAGER') throw AppError.forbidden('The company plan is written by the company\'s Manager.');
      if (!user.companyId) throw AppError.conflict('You are not assigned to a company.');
      data = { scope: `COMPANY:${user.companyId}`, companyId: user.companyId };
    } else {
      if (user.role !== 'MANAGER') throw AppError.forbidden('Employee plans are written by the employee\'s Manager.');
      if (!employeeId) {
        throw AppError.badRequest('Some fields are missing or invalid.', [{ field: 'employeeId', message: 'Choose the employee.' }]);
      }
      const employee = await repository.findEmployee(employeeId, tx);
      if (!employee) throw AppError.notFound('Employee not found.');
      if (employee.companyId !== user.companyId) throw AppError.forbidden(); // company wall
      if (employee.user.role !== 'EMPLOYEE') {
        throw AppError.conflict('A Manager has no personal plan: the company plan is the Manager\'s plan.');
      }
      if (!['ACTIVE', 'ON_LEAVE'].includes(employee.employmentStatus)) {
        throw AppError.conflict('Plans can only be written for active employees.');
      }
      data = { scope: `EMPLOYEE:${employee.id}`, companyId: employee.companyId, employeeId: employee.id };
    }

    if (await repository.findPlanByScope(cycle.id, data.scope, tx)) {
      throw AppError.conflict(`This plan already exists in ${cycle.name}.`);
    }

    const created = await repository.createPlan({ ...data, cycleId: cycle.id, level, status: 'DRAFT', createdById: user.id }, tx);
    await recordAudit(
      { userId: user.id, action: 'PLAN_CREATED', entityType: 'Plan', entityId: created.id, details: { planYear: cycle.name, level, scope: data.scope } },
      tx,
    );
    return created;
  });

  return getPlan(plan.id, user);
}

// ---------- Moving a plan along ----------

// Shared steps: load, check, change the status only if it is still what we expect, audit.
async function transition(id, user, { check, from, data, action, details }) {
  await prisma.$transaction(async (tx) => {
    const plan = await getPlanOrFail(id, tx);
    assertCanView(user, plan);
    if (plan.cycle.status === 'CLOSED') throw AppError.conflict('This plan year is closed.');
    await check(plan, tx);
    if (!from.includes(plan.status)) throw AppError.conflict(`This plan is ${plan.status} and cannot be changed this way.`);
    if ((await repository.changePlanStatus(id, from, data(plan), tx)) === 0) {
      throw AppError.conflict('The plan was changed by someone else. Reload and try again.');
    }
    await recordAudit({ userId: user.id, action, entityType: 'Plan', entityId: id, details: details?.(plan) ?? { level: plan.level } }, tx);
  });
  return getPlan(id, user);
}

function assertReady(plan) {
  const problems = checkPlanReady(plan.level, plan.kpis, rulesOf(plan.cycle));
  if (problems.length > 0) {
    throw AppError.badRequest('The plan is not complete yet.', problems.map((message) => ({ message })));
  }
}

async function assertParentPlanActive(plan, parentLevel, tx) {
  const scope = parentLevel === 'HOLDING' ? 'HOLDING' : `COMPANY:${plan.companyId}`;
  const parent = await repository.findPlanByScope(plan.cycleId, scope, tx);
  if (!parent || parent.status !== 'ACTIVE') {
    throw AppError.conflict(
      parentLevel === 'HOLDING'
        ? 'The Holding plan must be active first. Ask the Holding to activate it.'
        : 'The company plan must be approved (active) first.',
    );
  }
}

export function submitPlan(id, user) {
  return transition(id, user, {
    from: EDITABLE,
    action: 'PLAN_SUBMITTED',
    async check(plan, tx) {
      if (plan.level !== 'COMPANY') throw AppError.conflict('Only company plans are submitted for approval.');
      if (!isWriter(user, plan)) throw AppError.forbidden('Only the company\'s Manager can submit its plan.');
      await assertParentPlanActive(plan, 'HOLDING', tx);
      assertReady(plan);
    },
    data: () => ({ status: 'SUBMITTED', submittedAt: new Date() }),
  });
}

export function approvePlan(id, user) {
  return transition(id, user, {
    from: ['SUBMITTED'],
    action: 'PLAN_APPROVED',
    async check(plan) {
      if (plan.level !== 'COMPANY') throw AppError.conflict('Only company plans are approved.');
      if (!isApprover(user)) throw AppError.forbidden('Only the primary Holding user, or a Holding user allowed to approve, can approve plans.');
    },
    data: () => ({ status: 'ACTIVE', approvedById: user.id, approvedAt: new Date(), returnComment: null }),
  });
}

export function returnPlan(id, { comment }, user) {
  return transition(id, user, {
    from: ['SUBMITTED'],
    action: 'PLAN_RETURNED',
    async check(plan) {
      if (plan.level !== 'COMPANY') throw AppError.conflict('Only company plans are returned.');
      if (!isApprover(user)) throw AppError.forbidden('Only the primary Holding user, or a Holding user allowed to approve, can return plans.');
    },
    data: () => ({ status: 'RETURNED', returnComment: comment }),
    details: () => ({ level: 'COMPANY', comment }),
  });
}

export function activatePlan(id, user) {
  return transition(id, user, {
    from: EDITABLE,
    action: 'PLAN_ACTIVATED',
    async check(plan, tx) {
      if (plan.level === 'COMPANY') throw AppError.conflict('A company plan is submitted for approval, not activated directly.');
      if (plan.level === 'HOLDING' && !isApprover(user)) {
        throw AppError.forbidden('Only the primary Holding user, or a Holding user allowed to approve, can activate the Holding plan.');
      }
      if (plan.level === 'INDIVIDUAL') {
        if (!isWriter(user, plan)) throw AppError.forbidden('Only the employee\'s Manager can activate this plan.');
        await assertParentPlanActive(plan, 'COMPANY', tx);
      }
      assertReady(plan);
    },
    data: () => ({ status: 'ACTIVE', approvedById: user.id, approvedAt: new Date() }),
  });
}

export async function acknowledgePlan(id, { comment }, user) {
  await prisma.$transaction(async (tx) => {
    const plan = await getPlanOrFail(id, tx);
    if (plan.level !== 'INDIVIDUAL' || user.role !== 'EMPLOYEE' || plan.employeeId !== user.employeeId) {
      throw AppError.forbidden('Only the employee can acknowledge their own plan.');
    }
    if (plan.status !== 'ACTIVE') throw AppError.forbidden('Your plan is not ready yet. Your Manager will share it with you.');
    const { count } = await tx.plan.updateMany({
      where: { id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgeComment: comment ?? null },
    });
    if (count === 0) throw AppError.conflict('You have already acknowledged this plan.');
    await recordAudit({ userId: user.id, action: 'PLAN_ACKNOWLEDGED', entityType: 'Plan', entityId: id, details: { comment: comment ?? null } }, tx);
  });
  return getPlan(id, user);
}

// ---------- Deleting ----------

export async function deletePlan(id, user) {
  await prisma.$transaction(async (tx) => {
    const plan = await getPlanOrFail(id, tx);
    assertCanView(user, plan);
    if (plan.cycle.status === 'CLOSED') throw AppError.conflict('This plan year is closed.');

    const writerDeletingDraft = isWriter(user, plan) && EDITABLE.includes(plan.status);
    const headDeletingActive = plan.status === 'ACTIVE' && user.role === 'HOLDING' && user.isPrimaryHoldingUser;
    if (!writerDeletingDraft && !headDeletingActive) {
      throw plan.status === 'SUBMITTED'
        ? AppError.conflict('A plan waiting for approval cannot be deleted.')
        : AppError.forbidden('Only the person who writes this plan can delete it while it is a draft. An active plan can only be deleted by the primary Holding user.');
    }
    if ((await repository.countLinkedKpis(id, tx)) > 0) {
      throw AppError.conflict('KPIs of the level below are linked to this plan. Delete those plans first.');
    }
    if ((await countActualsInPlan(id, tx)) > 0) {
      throw AppError.conflict('Actual numbers have already been entered in this plan, so it can no longer be deleted.');
    }
    await repository.deletePlan(id, tx);
    await recordAudit(
      { userId: user.id, action: 'PLAN_DELETED', entityType: 'Plan', entityId: id, details: { level: plan.level, scope: plan.scope, status: plan.status } },
      tx,
    );
  });
}
