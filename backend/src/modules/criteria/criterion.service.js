// The business rules for evaluation criteria.
//
// Rules:
//   • Only Holding users change criteria (checked in the routes). Everyone logged in can read them.
//   • There are two lists: EMPLOYEE criteria and MANAGER criteria.
//   • Criteria can only be changed while NO evaluation period is OPEN. Otherwise people in the
//     same period could be scored with different rules.
//   • The active weights of each list must add up to exactly 100% before a period can be opened
//     (checked in the period service). While editing, the totals may be temporarily different;
//     the list endpoint shows the totals so the Holding can see what to fix.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import * as periodRepository from '../periods/period.repository.js';
import * as criterionRepository from './criterion.repository.js';

const toResponse = criterionRepository.toCriterionResponse;

async function assertNoOpenPeriod(db) {
  if ((await periodRepository.countOpen(db)) > 0) {
    throw AppError.conflict(
      'Criteria cannot be changed while an evaluation period is open. Close the open period first.',
    );
  }
}

async function assertNameIsFree(appliesTo, name, excludeId, db) {
  if (await criterionRepository.findActiveByName(appliesTo, name, excludeId, db)) {
    throw AppError.conflict(`An active ${appliesTo.toLowerCase()} criterion with this name already exists.`);
  }
}

export async function listCriteria(query) {
  const [items, totals] = await Promise.all([
    criterionRepository.findMany(query),
    criterionRepository.activeWeightTotals(),
  ]);
  return { items: items.map(toResponse), totals: criterionRepository.toTotalsResponse(totals) };
}

export async function getCriterion(id) {
  const criterion = await criterionRepository.findById(id);
  if (!criterion) throw AppError.notFound('Criterion not found.');
  return toResponse(criterion);
}

export async function createCriterion(data, user) {
  const criterion = await prisma.$transaction(async (tx) => {
    await assertNoOpenPeriod(tx);
    await assertNameIsFree(data.appliesTo, data.name, null, tx);

    const created = await criterionRepository.create(data, tx);
    await recordAudit(
      { userId: user.id, action: 'CRITERION_CREATED', entityType: 'EvaluationCriterion', entityId: created.id, details: data },
      tx,
    );
    return created;
  });

  return toResponse(criterion);
}

export async function updateCriterion(id, data, user) {
  const criterion = await prisma.$transaction(async (tx) => {
    await assertNoOpenPeriod(tx);

    const before = await criterionRepository.findById(id, tx);
    if (!before) throw AppError.notFound('Criterion not found.');
    if (data.name && before.isActive) {
      await assertNameIsFree(before.appliesTo, data.name, id, tx);
    }

    const after = await criterionRepository.update(id, data, tx);

    const changes = {};
    for (const field of Object.keys(data)) {
      const from = field === 'weight' ? Number(before.weight) : before[field];
      const to = field === 'weight' ? Number(after.weight) : after[field];
      if (from !== to) changes[field] = { from, to };
    }
    await recordAudit(
      { userId: user.id, action: 'CRITERION_UPDATED', entityType: 'EvaluationCriterion', entityId: id, details: changes },
      tx,
    );
    return after;
  });

  return toResponse(criterion);
}

export async function setCriterionStatus(id, { isActive }, user) {
  const criterion = await prisma.$transaction(async (tx) => {
    await assertNoOpenPeriod(tx);

    const before = await criterionRepository.findById(id, tx);
    if (!before) throw AppError.notFound('Criterion not found.');
    if (before.isActive === isActive) {
      throw AppError.conflict(`This criterion is already ${isActive ? 'active' : 'inactive'}.`);
    }
    if (isActive) {
      await assertNameIsFree(before.appliesTo, before.name, id, tx);
    }

    const after = await criterionRepository.update(id, { isActive }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: isActive ? 'CRITERION_ACTIVATED' : 'CRITERION_DEACTIVATED',
        entityType: 'EvaluationCriterion',
        entityId: id,
      },
      tx,
    );
    return after;
  });

  return toResponse(criterion);
}