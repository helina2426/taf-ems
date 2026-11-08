// The business rules for evaluation periods.
//
// A period moves through these steps:
//
//     UPCOMING ──open──▶ OPEN ──close──▶ CLOSED
//                         ▲                │
//                         └────reopen──────┘   (for late corrections)
//
// Rules:
//   • Only Holding users create and change periods (checked in the routes). Everyone can read them.
//   • A period can only be OPENED when both criteria lists add up to exactly 100%.
//   • A CLOSED period cannot be edited (reopen it first).

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { toDateOnly } from '../../shared/validation.js';
import * as criterionRepository from '../criteria/criterion.repository.js';
import * as periodRepository from './period.repository.js';

const toResponse = periodRepository.toPeriodResponse;

// Which status changes are allowed, from → [to].
const ALLOWED_CHANGES = {
  UPCOMING: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['OPEN'],
};

async function getPeriodOrFail(id, db) {
  const period = await periodRepository.findById(id, db);
  if (!period) throw AppError.notFound('Evaluation period not found.');
  return period;
}

async function assertNameIsFree(name, excludeId, db) {
  if (await periodRepository.findByName(name, excludeId, db)) {
    throw AppError.conflict('An evaluation period with this name already exists.');
  }
}

export async function listPeriods(query) {
  const periods = await periodRepository.findMany(query);
  return { items: periods.map(toResponse) };
}

export async function getPeriod(id) {
  return toResponse(await getPeriodOrFail(id));
}

export async function createPeriod(data, user) {
  const period = await prisma.$transaction(async (tx) => {
    await assertNameIsFree(data.name, null, tx);
    const created = await periodRepository.create({ ...data, status: 'UPCOMING', createdById: user.id }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'PERIOD_CREATED',
        entityType: 'EvaluationPeriod',
        entityId: created.id,
        details: { name: data.name, startDate: toDateOnly(data.startDate), endDate: toDateOnly(data.endDate) },
      },
      tx,
    );
    return created;
  });

  return toResponse(period);
}

export async function updatePeriod(id, data, user) {
  const period = await prisma.$transaction(async (tx) => {
    const before = await getPeriodOrFail(id, tx);
    if (before.status === 'CLOSED') {
      throw AppError.conflict('A closed period cannot be changed. Reopen it first.');
    }
    if (data.name) {
      await assertNameIsFree(data.name, id, tx);
    }

    // Check the dates together with the values already saved.
    const startDate = data.startDate ?? before.startDate;
    const endDate = data.endDate ?? before.endDate;
    if (endDate <= startDate) {
      throw AppError.badRequest('Some fields are missing or invalid.', [
        { field: 'endDate', message: 'End date must be after the start date.' },
      ]);
    }

    const after = await periodRepository.update(id, data, tx);

    const changes = {};
    if (data.name && data.name !== before.name) changes.name = { from: before.name, to: after.name };
    for (const field of ['startDate', 'endDate']) {
      if (data[field] && toDateOnly(before[field]) !== toDateOnly(after[field])) {
        changes[field] = { from: toDateOnly(before[field]), to: toDateOnly(after[field]) };
      }
    }
    await recordAudit(
      { userId: user.id, action: 'PERIOD_UPDATED', entityType: 'EvaluationPeriod', entityId: id, details: changes },
      tx,
    );
    return after;
  });

  return toResponse(period);
}

export async function setPeriodStatus(id, { status }, user) {
  const period = await prisma.$transaction(async (tx) => {
    const before = await getPeriodOrFail(id, tx);

    if (before.status === status) {
      throw AppError.conflict(`The period is already ${status}.`);
    }
    if (!ALLOWED_CHANGES[before.status].includes(status)) {
      throw AppError.conflict(`A period cannot go from ${before.status} to ${status}.`);
    }

    // Before opening: both criteria lists must be complete.
    if (status === 'OPEN') {
      const totals = await criterionRepository.activeWeightTotals(tx);
      const problems = Object.entries(totals)
        .filter(([, total]) => total !== 100)
        .map(([list, total]) => `${list.toLowerCase()} criteria add up to ${total}%`);
      if (problems.length > 0) {
        throw AppError.conflict(
          `The period cannot be opened: ${problems.join(' and ')}. Each list must add up to exactly 100%.`,
        );
      }
    }

    const after = await periodRepository.update(id, { status }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: 'PERIOD_STATUS_CHANGED',
        entityType: 'EvaluationPeriod',
        entityId: id,
        details: { from: before.status, to: status },
      },
      tx,
    );
    return after;
  });

  return toResponse(period);
}