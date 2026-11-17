// Database access for plan years (PerformanceCycle) and their 19 periods (EvaluationPeriod).

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';
import { RULE_NAMES } from './planYear.validation.js';

const planYearInclude = { createdBy: { select: { email: true } } };
const periodOrder = [{ startDate: 'asc' }, { sequence: 'asc' }];

export function findMany({ status }) {
  return prisma.performanceCycle.findMany({
    where: { ...(status && { status }) },
    include: planYearInclude,
    orderBy: { startDate: 'desc' },
  });
}

export function findById(id, db = prisma) {
  return db.performanceCycle.findUnique({ where: { id }, include: planYearInclude });
}

export function findPeriods(cycleId, db = prisma) {
  return db.evaluationPeriod.findMany({ where: { cycleId }, orderBy: periodOrder });
}

// Another plan year whose dates overlap [startDate, endDate]?
export function findOverlapping(startDate, endDate, db = prisma) {
  return db.performanceCycle.findFirst({
    where: { startDate: { lte: new Date(endDate) }, endDate: { gte: new Date(startDate) } },
  });
}

// Plan-year names and period names must be unique (also against version-1 periods).
export async function findTakenNames(cycleName, periodNames, db = prisma) {
  const [cycle, periods] = await Promise.all([
    db.performanceCycle.findFirst({ where: { name: { equals: cycleName, mode: 'insensitive' } } }),
    db.evaluationPeriod.findMany({ where: { name: { in: periodNames, mode: 'insensitive' } }, select: { name: true } }),
  ]);
  return [...(cycle ? [cycle.name] : []), ...periods.map((p) => p.name)];
}

export function create(data, db = prisma) {
  return db.performanceCycle.create({ data, include: planYearInclude });
}

export function createPeriods(rows, db = prisma) {
  return db.evaluationPeriod.createMany({ data: rows });
}

export function update(id, data, db = prisma) {
  return db.performanceCycle.update({ where: { id }, data, include: planYearInclude });
}

// Changes the status ONLY if it is still `from` (two people clicking at the same time:
// only the first one wins). Returns how many rows changed (0 or 1).
export async function changeStatus(id, from, to, db = prisma) {
  const { count } = await db.performanceCycle.updateMany({ where: { id, status: from }, data: { status: to } });
  return count;
}

export function setPeriodStatuses(where, status, db = prisma) {
  return db.evaluationPeriod.updateMany({ where, data: { status } });
}

export async function changePeriodStatus(periodId, from, to, db = prisma) {
  const { count } = await db.evaluationPeriod.updateMany({ where: { id: periodId, status: from }, data: { status: to } });
  return count;
}

export function findPeriod(cycleId, periodId, db = prisma) {
  return db.evaluationPeriod.findFirst({ where: { id: periodId, cycleId } });
}

export function countPeriods(cycleId, where, db = prisma) {
  return db.evaluationPeriod.count({ where: { cycleId, ...where } });
}

export function remove(id, db = prisma) {
  // The 19 periods are deleted with it (onDelete: Cascade in the schema).
  return db.performanceCycle.delete({ where: { id } });
}

// ---------- Turning database rows into replies ----------

function toPeriodResponse(period) {
  return {
    id: period.id,
    type: period.type,
    sequence: period.sequence,
    name: period.name,
    startDate: toDateOnly(period.startDate),
    endDate: toDateOnly(period.endDate),
    status: period.status,
  };
}

// The periods as a tree: year → halves → quarters → months.
export function toPeriodTree(periods) {
  const nodes = new Map(periods.map((p) => [p.id, { ...toPeriodResponse(p), children: [] }]));
  let root = null;
  for (const period of periods) {
    const node = nodes.get(period.id);
    if (period.parentId && nodes.has(period.parentId)) nodes.get(period.parentId).children.push(node);
    else if (period.type === 'YEAR') root = node;
  }
  for (const node of nodes.values()) {
    node.children.sort((a, b) => a.sequence - b.sequence);
    if (node.type === 'MONTH') delete node.children;
  }
  return root;
}

export function toPlanYearResponse(cycle, periods) {
  return {
    id: cycle.id,
    name: cycle.name,
    calendar: cycle.calendar,
    year: cycle.year,
    startDate: toDateOnly(cycle.startDate),
    endDate: toDateOnly(cycle.endDate),
    status: cycle.status,
    rules: Object.fromEntries(RULE_NAMES.map((name) => [name, cycle[name]])),
    createdBy: cycle.createdBy?.email ?? null,
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
    ...(periods && { periods: toPeriodTree(periods) }),
  };
}
