// The business rules for KPIs (version 2, Module 12).
//
//   • KPIs are only added, changed or removed while their plan is DRAFT or RETURNED,
//     by the person who writes the plan (see plan.access.js).
//   • Hierarchy: a company KPI must link to a KPI of the Holding plan; an employee KPI must link
//     to a KPI of HIS company's plan, in the same plan year. The Holding plan's KPIs link to nothing.
//   • Weights (whole points): none on the Holding plan; on other plans each KPI weighs between the
//     year's minimum and maximum (10–40 by default). The total is checked when the plan is submitted.
//   • A "zero is best" KPI (accidents…) has a year target of 0 and adds the months up (SUM).
//   • Every new KPI gets 12 monthly targets automatically (see splitYearTarget). They can be
//     changed by hand; changing the year target, the direction or the aggregation splits it again.
//   • A KPI that other KPIs are linked to cannot be removed.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { assertCanWrite } from './plan.access.js';
import { checkMonthTargets, splitYearTarget } from './plan.rules.js';
import * as repository from './plan.repository.js';
import { getPlan, getPlanOrFail } from './plan.service.js';

const fieldError = (field, message) => AppError.badRequest('Some fields are missing or invalid.', [{ field, message }]);

// Checks the KPI fields together, against its plan. `kpi` = all values (saved + changes).
async function checkKpi(plan, kpi, tx) {
  const rules = plan.cycle;

  if (kpi.direction === 'ZERO') {
    if (kpi.yearTarget !== 0) throw fieldError('yearTarget', 'For a "zero is best" KPI, the year target is 0.');
    if (kpi.aggregation !== 'SUM') throw fieldError('aggregation', 'A "zero is best" KPI adds the months up (SUM).');
  }

  if (plan.level === 'HOLDING') {
    if (kpi.parentKpiId) throw fieldError('parentKpiId', 'The Holding plan is the top level: its KPIs are not linked to anything.');
    if (kpi.weight !== null && kpi.weight !== undefined) throw fieldError('weight', 'The Holding plan has no weights.');
    return;
  }

  if (kpi.weight === null || kpi.weight === undefined) throw fieldError('weight', 'Give the KPI a weight (points).');
  if (kpi.weight < rules.minKpiWeight || kpi.weight > rules.maxKpiWeight) {
    throw fieldError('weight', `Each KPI must weigh between ${rules.minKpiWeight} and ${rules.maxKpiWeight} points.`);
  }

  if (!kpi.parentKpiId) {
    throw fieldError('parentKpiId', plan.level === 'COMPANY' ? 'Choose the Holding KPI this KPI helps to reach.' : 'Choose the company KPI this KPI helps to reach.');
  }
  const parent = await repository.findKpiById(kpi.parentKpiId, tx);
  const wantedLevel = plan.level === 'COMPANY' ? 'HOLDING' : 'COMPANY';
  const sameTree = parent && parent.plan.cycleId === plan.cycleId && parent.plan.level === wantedLevel &&
    (wantedLevel === 'HOLDING' || parent.plan.companyId === plan.companyId); // company wall
  if (!sameTree) {
    throw fieldError('parentKpiId', plan.level === 'COMPANY'
      ? 'Link the KPI to a KPI of this year\'s Holding plan.'
      : 'Link the KPI to a KPI of your company\'s plan for this year.');
  }
}

async function loadWritableKpi(id, user, tx) {
  const kpi = await repository.findKpiById(id, tx);
  if (!kpi) throw AppError.notFound('KPI not found.');
  const plan = await getPlanOrFail(kpi.planId, tx);
  assertCanWrite(user, plan);
  return { kpi, plan };
}

const asNumber = (value) => (value === null || value === undefined ? value : Number(value));

export async function createKpi({ planId, ...data }, user) {
  await prisma.$transaction(async (tx) => {
    const plan = await getPlanOrFail(planId, tx);
    assertCanWrite(user, plan);
    if (plan.level !== 'HOLDING' && plan.kpis.length >= plan.cycle.maxKpis) {
      throw AppError.conflict(`A plan can have at most ${plan.cycle.maxKpis} KPIs.`);
    }
    const values = { weight: null, parentKpiId: null, baseline: null, ...data };
    await checkKpi(plan, values, tx);

    const created = await repository.createKpi({ ...values, planId, sortOrder: values.sortOrder ?? plan.kpis.length }, tx);
    const months = await repository.findMonths(plan.cycleId, tx);
    const targets = splitYearTarget(values.yearTarget, values.aggregation, values.direction);
    await repository.createKpiMonths(months.map((m, i) => ({ kpiId: created.id, periodId: m.id, target: targets[i] })), tx);

    await recordAudit(
      { userId: user.id, action: 'KPI_CREATED', entityType: 'Kpi', entityId: created.id, details: { planId, name: values.name, yearTarget: values.yearTarget, weight: values.weight } },
      tx,
    );
  });
  return getPlan(planId, user);
}

export async function updateKpi(id, data, user) {
  const planId = await prisma.$transaction(async (tx) => {
    const { kpi, plan } = await loadWritableKpi(id, user, tx);
    const before = { ...kpi, yearTarget: asNumber(kpi.yearTarget), baseline: asNumber(kpi.baseline) };
    const after = { ...before, ...data };
    await checkKpi(plan, after, tx);

    await repository.updateKpi(id, data, tx);

    // A new target, direction or aggregation: split the year again.
    const resplit = ['yearTarget', 'direction', 'aggregation'].some((f) => f in data && data[f] !== before[f]);
    if (resplit) {
      const months = await repository.findMonths(plan.cycleId, tx);
      await repository.setKpiMonthTargets(id, months, splitYearTarget(after.yearTarget, after.aggregation, after.direction), tx);
    }

    const changes = {};
    for (const field of Object.keys(data)) {
      if (before[field] !== after[field]) changes[field] = { from: before[field] ?? null, to: after[field] ?? null };
    }
    await recordAudit({ userId: user.id, action: 'KPI_UPDATED', entityType: 'Kpi', entityId: id, details: { name: after.name, ...changes, monthsSplitAgain: resplit } }, tx);
    return plan.id;
  });
  return getPlan(planId, user);
}

export async function deleteKpi(id, user) {
  const planId = await prisma.$transaction(async (tx) => {
    const { kpi, plan } = await loadWritableKpi(id, user, tx);
    if (kpi._count.childKpis > 0) {
      throw AppError.conflict('Other KPIs are linked to this KPI. Remove or relink them first.');
    }
    await repository.deleteKpi(id, tx);
    await recordAudit({ userId: user.id, action: 'KPI_DELETED', entityType: 'Kpi', entityId: id, details: { name: kpi.name, planId: plan.id } }, tx);
    return plan.id;
  });
  return getPlan(planId, user);
}

export async function setMonthTargets(id, { targets }, user) {
  const planId = await prisma.$transaction(async (tx) => {
    const { kpi, plan } = await loadWritableKpi(id, user, tx);
    if (kpi.direction === 'ZERO' && targets.some((t) => t !== 0)) {
      throw fieldError('targets', 'A "zero is best" KPI has a target of 0 every month.');
    }
    const problem = checkMonthTargets(targets, Number(kpi.yearTarget), kpi.aggregation);
    if (problem) throw fieldError('targets', problem);

    const months = await repository.findMonths(plan.cycleId, tx);
    await repository.setKpiMonthTargets(id, months, targets, tx);
    await recordAudit({ userId: user.id, action: 'KPI_MONTHS_UPDATED', entityType: 'Kpi', entityId: id, details: { name: kpi.name, targets } }, tx);
    return plan.id;
  });
  return getPlan(planId, user);
}
