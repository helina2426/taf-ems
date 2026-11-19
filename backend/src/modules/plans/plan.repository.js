// Database access for plans, KPIs and their monthly targets.

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';

const personSelect = { id: true, firstName: true, lastName: true, jobTitle: true, companyId: true };

const planSummaryInclude = {
  cycle: true,
  company: { select: { id: true, name: true } },
  employee: { select: personSelect },
  kpis: { select: { weight: true } },
};

const kpiInclude = {
  parentKpi: { select: { id: true, name: true, unit: true, plan: { select: { level: true } } } },
  months: { include: { period: true }, orderBy: { period: { sequence: 'asc' } } },
  childKpis: {
    select: {
      id: true,
      name: true,
      yearTarget: true,
      unit: true,
      plan: {
        select: {
          id: true,
          level: true,
          status: true,
          company: { select: { id: true, name: true } },
          employee: { select: personSelect },
        },
      },
    },
  },
};

export const planDetailInclude = {
  ...planSummaryInclude,
  createdBy: { select: { email: true } },
  approvedBy: { select: { email: true } },
  kpis: { include: kpiInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
};

// ---------- Reading ----------

export function findPlans(where) {
  return prisma.plan.findMany({
    where,
    include: planSummaryInclude,
    orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findPlanById(id, db = prisma) {
  return db.plan.findUnique({ where: { id }, include: planDetailInclude });
}

export function findPlanByScope(cycleId, scope, db = prisma) {
  return db.plan.findUnique({ where: { cycleId_scope: { cycleId, scope } }, include: planDetailInclude });
}

export function findCycle(id, db = prisma) {
  return db.performanceCycle.findUnique({ where: { id } });
}

export function findMonths(cycleId, db = prisma) {
  return db.evaluationPeriod.findMany({ where: { cycleId, type: 'MONTH' }, orderBy: { sequence: 'asc' } });
}

export function findEmployee(id, db = prisma) {
  return db.employee.findUnique({ where: { id }, include: { user: { select: { role: true } }, company: true } });
}

export function findKpiById(id, db = prisma) {
  return db.kpi.findUnique({
    where: { id },
    include: { plan: { include: { cycle: true } }, _count: { select: { childKpis: true } } },
  });
}

export function countKpis(planId, db = prisma) {
  return db.kpi.count({ where: { planId } });
}

// How many KPIs of the plan have other KPIs linked to them.
export function countLinkedKpis(planId, db = prisma) {
  return db.kpi.count({ where: { planId, childKpis: { some: {} } } });
}

export function countPlansInCycle(cycleId, db = prisma) {
  return db.plan.count({ where: { cycleId } });
}

// ---------- Writing ----------

export function createPlan(data, db = prisma) {
  return db.plan.create({ data });
}

// Changes the status ONLY if it is still one of `from` (two people clicking at the same time:
// only the first one wins). Returns how many rows changed (0 or 1).
export async function changePlanStatus(id, from, data, db = prisma) {
  const { count } = await db.plan.updateMany({ where: { id, status: { in: from } }, data });
  return count;
}

export function updatePlan(id, data, db = prisma) {
  return db.plan.update({ where: { id }, data });
}

export function deletePlan(id, db = prisma) {
  // Its KPIs and their months are deleted with it (onDelete: Cascade in the schema).
  return db.plan.delete({ where: { id } });
}

export function createKpi(data, db = prisma) {
  return db.kpi.create({ data });
}

export function updateKpi(id, data, db = prisma) {
  return db.kpi.update({ where: { id }, data });
}

export function deleteKpi(id, db = prisma) {
  return db.kpi.delete({ where: { id } });
}

export function createKpiMonths(rows, db = prisma) {
  return db.kpiMonth.createMany({ data: rows });
}

export async function setKpiMonthTargets(kpiId, months, targets, db = prisma) {
  for (let i = 0; i < months.length; i += 1) {
    await db.kpiMonth.update({
      where: { kpiId_periodId: { kpiId, periodId: months[i].id } },
      data: { target: targets[i] },
    });
  }
}

// ---------- Turning database rows into replies ----------

const num = (value) => (value === null || value === undefined ? null : Number(value));

export function toPerson(employee) {
  return employee
    ? { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, jobTitle: employee.jobTitle ?? null }
    : null;
}

export function toPlanSummary(plan) {
  return {
    id: plan.id,
    level: plan.level,
    status: plan.status,
    planYear: { id: plan.cycle.id, name: plan.cycle.name, status: plan.cycle.status },
    company: plan.company ?? null,
    employee: toPerson(plan.employee),
    kpiCount: plan.kpis.length,
    weightTotal: plan.kpis.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0),
    submittedAt: plan.submittedAt,
    approvedAt: plan.approvedAt,
    acknowledgedAt: plan.acknowledgedAt,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function toKpiResponse(kpi, { showLinked }) {
  return {
    id: kpi.id,
    perspective: kpi.perspective,
    name: kpi.name,
    description: kpi.description,
    unit: kpi.unit,
    direction: kpi.direction,
    aggregation: kpi.aggregation,
    baseline: num(kpi.baseline),
    yearTarget: num(kpi.yearTarget),
    weight: kpi.weight,
    sortOrder: kpi.sortOrder,
    parentKpi: kpi.parentKpi ? { id: kpi.parentKpi.id, name: kpi.parentKpi.name, unit: kpi.parentKpi.unit, level: kpi.parentKpi.plan.level } : null,
    months: kpi.months.map((m) => ({
      periodId: m.periodId,
      sequence: m.period.sequence,
      name: m.period.name,
      startDate: toDateOnly(m.period.startDate),
      endDate: toDateOnly(m.period.endDate),
      target: num(m.target),
    })),
    // The KPIs of the level below that are linked to this one (only shown to people allowed to see them).
    linkedKpis: showLinked
      ? kpi.childKpis.map((child) => ({
          id: child.id,
          name: child.name,
          unit: child.unit,
          yearTarget: num(child.yearTarget),
          planId: child.plan.id,
          planStatus: child.plan.status,
          owner: child.plan.level === 'COMPANY' ? child.plan.company?.name : [child.plan.employee?.firstName, child.plan.employee?.lastName].join(' '),
        }))
      : null,
  };
}
