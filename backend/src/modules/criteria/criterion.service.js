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
//
// Version 2 (Module 15): criteria are now called "behaviours".
//   • Each behaviour can describe what a score of 1, 2, 3, 4 and 5 looks like (levelDescriptions).
//   • One behaviour per list can be the Safety behaviour (isSafety), used by the optional safety rule.
//   • "Use the standard behaviours" switches the current lists off (nothing is deleted: old
//     evaluations keep their scores) and adds the standard Taf lists (standardBehaviours.js).

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import * as periodRepository from '../periods/period.repository.js';
import * as criterionRepository from './criterion.repository.js';
import { LEVEL_NAMES, STANDARD_BEHAVIOURS, isStandard, standardRows } from './standardBehaviours.js';

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

async function assertOneSafety(appliesTo, excludeId, db) {
  if (await criterionRepository.findActiveSafety(appliesTo, excludeId, db)) {
    throw AppError.conflict(`The ${appliesTo.toLowerCase()} list already has an active Safety behaviour. Only one is allowed.`);
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
    if (data.isSafety) await assertOneSafety(data.appliesTo, null, tx);

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
    if (data.isSafety && before.isActive) await assertOneSafety(before.appliesTo, id, tx);

    const after = await criterionRepository.update(id, data, tx);

    const value = (row, field) => (field === 'weight' ? Number(row.weight) : field === 'levelDescriptions' ? JSON.stringify(row[field] ?? null) : row[field]);
    const changes = {};
    for (const field of Object.keys(data)) {
      const from = value(before, field);
      const to = value(after, field);
      if (from !== to) changes[field] = field === 'levelDescriptions' ? { changed: true } : { from, to };
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
      if (before.isSafety) await assertOneSafety(before.appliesTo, id, tx);
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
// ---------- Version 2: the standard behaviour lists ----------

export function getStandardBehaviours() {
  return { levelNames: LEVEL_NAMES, lists: STANDARD_BEHAVIOURS };
}

export async function useStandardBehaviours(user) {
  await prisma.$transaction(async (tx) => {
    await assertNoOpenPeriod(tx);
    const active = await criterionRepository.findActive(tx);
    const alreadyStandard = ['EMPLOYEE', 'MANAGER'].every((list) => isStandard(active.filter((c) => c.appliesTo === list), list));
    if (alreadyStandard) throw AppError.conflict('The standard behaviours are already in use.');

    // Switch the current lists off (they stay in the database: old evaluations keep their scores),
    // then add the standard lists.
    const { count: deactivated } = await criterionRepository.deactivateAll(tx);
    const rows = standardRows();
    await criterionRepository.createMany(rows, tx);
    await recordAudit(
      { userId: user.id, action: 'CRITERIA_STANDARD_LOADED', entityType: 'EvaluationCriterion', details: { deactivated, created: rows.length } },
      tx,
    );
  });
  return listCriteria({});
}
