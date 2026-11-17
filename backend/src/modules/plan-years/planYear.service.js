// The business rules for plan years (version 2).
//
// A plan year moves through these steps:
//
//     PLANNING ──activate──▶ ACTIVE ──close──▶ CLOSED
//         ▲                    │   ▲             │
//         └──back to planning──┘   └───reopen────┘  (reopen: primary Holding user only)
//
// Rules:
//   • Only Holding users create and change plan years (checked in the routes). Everyone can read them.
//   • The calendar of a new plan year comes from the Holding setting (Ethiopian by default).
//   • Two plan years may not overlap in time. Several can be ACTIVE together: the old year
//     stays ACTIVE while its final evaluations are done in the first month of the new year.
//   • The rules of a year (70/30 split, 120% cap, …) can only be changed while it is PLANNING.
//   • Activating opens the year, and every half, quarter and month that has already started.
//     The other months are opened by a Holding user when their time comes.
//   • A CLOSED month is frozen (later modules: its actual numbers cannot change). It can be
//     reopened for a late correction, and every change is written to the audit log.
//   • "Back to planning" puts every period back to UPCOMING. (Module 12 will add: not possible
//     once plans have been written in the year.)
//   • Only a PLANNING year can be deleted.

import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPlanYear } from '../../shared/planYear.js';
import { getHoldingOrFail } from '../settings/settings.service.js';
import * as repository from './planYear.repository.js';
import { DEFAULT_RULES, checkRules } from './planYear.rules.js';
import { RULE_NAMES } from './planYear.validation.js';

const MONTH_CHANGES = { UPCOMING: ['OPEN'], OPEN: ['CLOSED'], CLOSED: ['OPEN'] };
const YEAR_CHANGES = { PLANNING: ['ACTIVE'], ACTIVE: ['PLANNING', 'CLOSED'], CLOSED: ['ACTIVE'] };

// Today's date in Addis Ababa, as "YYYY-MM-DD".
export function todayInAddis(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
}

function assertRules(rules) {
  const problems = checkRules(rules);
  if (problems.length > 0) throw AppError.badRequest('Some fields are missing or invalid.', problems);
}

async function getPlanYearOrFail(id, db) {
  const cycle = await repository.findById(id, db);
  if (!cycle) throw AppError.notFound('Plan year not found.');
  return cycle;
}

async function withPeriods(cycle, db) {
  return repository.toPlanYearResponse(cycle, await repository.findPeriods(cycle.id, db));
}

export async function listPlanYears(query) {
  const cycles = await repository.findMany(query);
  return { items: cycles.map((cycle) => repository.toPlanYearResponse(cycle)) };
}

export async function getPlanYear(id) {
  return withPeriods(await getPlanYearOrFail(id));
}

// What a new plan year would look like (nothing is saved). The calendar comes from the settings.
export async function previewPlanYear({ year }) {
  const holding = await getHoldingOrFail();
  const built = buildPlanYear(holding.cycleCalendar, year);
  return {
    name: built.name,
    calendar: built.calendar,
    year,
    startDate: built.startDate,
    endDate: built.endDate,
    periods: built.periods.map(({ key, parentKey, ...period }) => period),
  };
}

export async function createPlanYear({ year, ...ruleValues }, user) {
  const cycle = await prisma.$transaction(async (tx) => {
    const holding = await getHoldingOrFail(tx);
    const built = buildPlanYear(holding.cycleCalendar, year);

    // The default rules come from the database defaults; the ones sent here replace them.
    assertRules({ ...DEFAULT_RULES, ...ruleValues });

    const taken = await repository.findTakenNames(built.name, built.periods.map((p) => p.name), tx);
    if (taken.length > 0) throw AppError.conflict(`The plan year "${built.name}" already exists.`);

    const overlapping = await repository.findOverlapping(built.startDate, built.endDate, tx);
    if (overlapping) {
      throw AppError.conflict(`"${built.name}" would overlap with the plan year "${overlapping.name}". Plan years cannot overlap.`);
    }

    const created = await repository.create(
      {
        holdingId: holding.id,
        name: built.name,
        calendar: built.calendar,
        year,
        startDate: new Date(built.startDate),
        endDate: new Date(built.endDate),
        status: 'PLANNING',
        createdById: user.id,
        ...ruleValues,
      },
      tx,
    );

    // Give every period its id now, so each one can point to its parent in one insert.
    const ids = Object.fromEntries(built.periods.map((p) => [p.key, randomUUID()]));
    await repository.createPeriods(
      built.periods.map((p) => ({
        id: ids[p.key],
        cycleId: created.id,
        parentId: p.parentKey ? ids[p.parentKey] : null,
        type: p.type,
        sequence: p.sequence,
        name: p.name,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        status: 'UPCOMING',
        createdById: user.id,
      })),
      tx,
    );

    await recordAudit(
      {
        userId: user.id,
        action: 'PLAN_YEAR_CREATED',
        entityType: 'PerformanceCycle',
        entityId: created.id,
        details: { name: built.name, calendar: built.calendar, startDate: built.startDate, endDate: built.endDate },
      },
      tx,
    );
    return created;
  });

  return getPlanYear(cycle.id);
}

export async function updatePlanYear(id, data, user) {
  const cycle = await prisma.$transaction(async (tx) => {
    const before = await getPlanYearOrFail(id, tx);
    if (before.status !== 'PLANNING') {
      throw AppError.conflict('The rules of a plan year can only be changed while it is PLANNING.');
    }
    const current = Object.fromEntries(RULE_NAMES.map((name) => [name, before[name]]));
    assertRules({ ...current, ...data });

    const after = await repository.update(id, data, tx);
    const changes = {};
    for (const name of Object.keys(data)) {
      if (before[name] !== after[name]) changes[name] = { from: before[name], to: after[name] };
    }
    await recordAudit(
      { userId: user.id, action: 'PLAN_YEAR_UPDATED', entityType: 'PerformanceCycle', entityId: id, details: changes },
      tx,
    );
    return after;
  });

  return getPlanYear(cycle.id);
}

export async function setPlanYearStatus(id, { status }, user) {
  await prisma.$transaction(async (tx) => {
    const before = await getPlanYearOrFail(id, tx);

    if (before.status === status) throw AppError.conflict(`The plan year is already ${status}.`);
    if (!YEAR_CHANGES[before.status].includes(status)) {
      throw AppError.conflict(`A plan year cannot go from ${before.status} to ${status}.`);
    }

    const reopening = before.status === 'CLOSED' && status === 'ACTIVE';
    if (reopening && !user.isPrimaryHoldingUser) {
      throw AppError.forbidden('Only the primary Holding user can reopen a closed plan year.');
    }

    if ((await repository.changeStatus(id, before.status, status, tx)) === 0) {
      throw AppError.conflict('The plan year was changed by someone else. Reload and try again.');
    }

    // What happens to the 19 periods.
    if (status === 'ACTIVE' && !reopening) {
      // Open the year, and every half, quarter and month that has already started.
      await repository.setPeriodStatuses(
        { cycleId: id, OR: [{ type: 'YEAR' }, { startDate: { lte: new Date(todayInAddis()) } }] },
        'OPEN',
        tx,
      );
    } else if (reopening) {
      await repository.setPeriodStatuses({ cycleId: id, type: 'YEAR' }, 'OPEN', tx);
    } else if (status === 'PLANNING') {
      await repository.setPeriodStatuses({ cycleId: id }, 'UPCOMING', tx);
    } else if (status === 'CLOSED') {
      await repository.setPeriodStatuses({ cycleId: id }, 'CLOSED', tx);
    }

    const action = { ACTIVE: reopening ? 'PLAN_YEAR_REOPENED' : 'PLAN_YEAR_ACTIVATED', PLANNING: 'PLAN_YEAR_BACK_TO_PLANNING', CLOSED: 'PLAN_YEAR_CLOSED' }[status];
    await recordAudit(
      { userId: user.id, action, entityType: 'PerformanceCycle', entityId: id, details: { name: before.name, from: before.status, to: status } },
      tx,
    );
  });

  return getPlanYear(id);
}

export async function setMonthStatus(id, periodId, { status }, user) {
  await prisma.$transaction(async (tx) => {
    const cycle = await getPlanYearOrFail(id, tx);
    const month = await repository.findPeriod(id, periodId, tx);
    if (!month || month.type !== 'MONTH') throw AppError.notFound('Month not found in this plan year.');

    if (cycle.status !== 'ACTIVE') {
      throw AppError.conflict('Months can only be opened or closed while the plan year is ACTIVE.');
    }
    if (month.status === status) throw AppError.conflict(`The month is already ${status}.`);
    if (!MONTH_CHANGES[month.status].includes(status)) {
      throw AppError.conflict(`A month cannot go from ${month.status} to ${status}.`);
    }
    if ((await repository.changePeriodStatus(periodId, month.status, status, tx)) === 0) {
      throw AppError.conflict('The month was changed by someone else. Reload and try again.');
    }

    await recordAudit(
      {
        userId: user.id,
        action: 'PERIOD_STATUS_CHANGED',
        entityType: 'EvaluationPeriod',
        entityId: periodId,
        details: { name: month.name, from: month.status, to: status },
      },
      tx,
    );
  });

  return getPlanYear(id);
}

export async function deletePlanYear(id, user) {
  await prisma.$transaction(async (tx) => {
    const cycle = await getPlanYearOrFail(id, tx);
    if (cycle.status !== 'PLANNING') {
      throw AppError.conflict('Only a plan year that is still PLANNING can be deleted.');
    }
    await repository.remove(id, tx);
    await recordAudit(
      { userId: user.id, action: 'PLAN_YEAR_DELETED', entityType: 'PerformanceCycle', entityId: id, details: { name: cycle.name } },
      tx,
    );
  });
}
