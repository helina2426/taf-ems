// The review steps that come after an evaluation is submitted (SRS FR-08, decisions 4, 7 and 13).
//
//   SUBMITTED ──approve──▶ APPROVED ──publish──▶ PUBLISHED ──acknowledge──▶ (acknowledged)
//       │
//       └──return (with a reason)──▶ RETURNED ──fixed and submitted again──▶ SUBMITTED
//
// Who may approve, return and publish: the primary Holding user, or a Holding user the
// primary user has allowed (canApproveEvaluations). Managers never approve.
//
// Extra rules:
//   • Nobody approves or returns an evaluation THEY submitted — except the primary Holding user,
//     because there is nobody above them.
//   • Returning needs a reason, and the period must still be OPEN (otherwise the evaluator
//     could not fix it). Approving and publishing are allowed after the period has closed.
//   • Every decision is saved in EvaluationReview (the full history) and in the audit log.
//   • Only the person evaluated can acknowledge, only once, with one optional comment.
//     Acknowledging means "I have read it", not "I agree", and it does not reopen anything.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import * as repository from './evaluation.repository.js';
import { isAuthorizedHoldingEvaluator, toResponse } from './evaluation.service.js';

function assertCanReview(user) {
  if (!isAuthorizedHoldingEvaluator(user)) {
    throw AppError.forbidden(
      'Only the primary Holding user, or a Holding user they have allowed, can approve and publish evaluations.',
    );
  }
}

async function getOrFail(id, db) {
  const evaluation = await repository.findById(id, db);
  if (!evaluation) throw AppError.notFound('Evaluation not found.');
  return evaluation;
}

function assertStatus(evaluation, expected, action) {
  if (evaluation.status !== expected) {
    throw AppError.conflict(`Only a ${expected} evaluation can be ${action}. This one is ${evaluation.status}.`);
  }
}

function assertNotOwnSubmission(evaluation, user) {
  if (evaluation.evaluatorId === user.id && !user.isPrimaryHoldingUser) {
    throw AppError.forbidden('You submitted this evaluation, so another approver must review it.');
  }
}

// Saves the new status, but only if nobody else changed it a moment before us.
async function changeStatusOrFail(id, fromStatus, data, tx) {
  const changed = await repository.changeStatus(id, fromStatus, data, tx);
  if (changed === 0) {
    throw AppError.conflict('This evaluation was just changed by someone else. Reload it and try again.');
  }
}

export async function approveEvaluation(id, { comment }, user) {
  assertCanReview(user);

  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getOrFail(id, tx);
    assertStatus(current, 'SUBMITTED', 'approved');
    assertNotOwnSubmission(current, user);

    await changeStatusOrFail(id, 'SUBMITTED', { status: 'APPROVED' }, tx);
    await repository.createReview({ evaluationId: id, reviewerId: user.id, decision: 'APPROVED', comment }, tx);
    await recordAudit(
      { userId: user.id, action: 'EVALUATION_APPROVED', entityType: 'Evaluation', entityId: id, details: { comment: comment ?? null } },
      tx,
    );
    return repository.findById(id, tx);
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function returnEvaluation(id, { comment }, user) {
  assertCanReview(user);

  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getOrFail(id, tx);
    assertStatus(current, 'SUBMITTED', 'returned');
    assertNotOwnSubmission(current, user);
    if (current.period.status !== 'OPEN') {
      throw AppError.conflict(
        `The period "${current.period.name}" is ${current.period.status}, so the evaluator could not fix this evaluation. Reopen the period first, or approve it.`,
      );
    }

    await changeStatusOrFail(id, 'SUBMITTED', { status: 'RETURNED' }, tx);
    await repository.createReview({ evaluationId: id, reviewerId: user.id, decision: 'RETURNED', comment }, tx);
    await recordAudit(
      { userId: user.id, action: 'EVALUATION_RETURNED', entityType: 'Evaluation', entityId: id, details: { comment } },
      tx,
    );
    return repository.findById(id, tx);
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function publishEvaluation(id, user) {
  assertCanReview(user);

  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getOrFail(id, tx);
    assertStatus(current, 'APPROVED', 'published');

    await changeStatusOrFail(id, 'APPROVED', { status: 'PUBLISHED', publishedAt: new Date(), publishedById: user.id }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: 'EVALUATION_PUBLISHED',
        entityType: 'Evaluation',
        entityId: id,
        details: { employeeId: current.employeeId, overallScore: Number(current.overallScore) },
      },
      tx,
    );
    return repository.findById(id, tx);
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function acknowledgeEvaluation(id, { comment }, user) {
  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getOrFail(id, tx);

    if (current.employee.user.id !== user.id) {
      throw AppError.forbidden('Only the person evaluated can acknowledge this evaluation.');
    }
    assertStatus(current, 'PUBLISHED', 'acknowledged');
    if (current.acknowledgedAt) {
      throw AppError.conflict('You have already acknowledged this evaluation.');
    }

    await repository.update(id, { acknowledgedAt: new Date(), employeeComment: comment ?? null }, tx);
    await recordAudit(
      { userId: user.id, action: 'EVALUATION_ACKNOWLEDGED', entityType: 'Evaluation', entityId: id, details: { withComment: Boolean(comment) } },
      tx,
    );
    return repository.findById(id, tx);
  });

  return toResponse(evaluation, user, { withDetails: true });
}
