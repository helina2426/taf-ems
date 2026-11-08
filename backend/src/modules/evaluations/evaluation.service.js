// The business rules for evaluations and scoring (SRS FR-07, decisions 6–7 and 10).
//
// Who evaluates whom:
//   • An EMPLOYEE is evaluated by the current Manager of their company   → type EMPLOYEE.
//   • A MANAGER is evaluated by the primary Holding user, or by a Holding user
//     the primary user has allowed (canApproveEvaluations)              → type MANAGER.
//   • Nobody evaluates themselves.
//
// Steps handled here:  (create) DRAFT ──score / feedback──▶ DRAFT ──submit──▶ SUBMITTED
// A RETURNED evaluation can be edited and submitted again, like a DRAFT.
// Approving, returning, publishing and acknowledging are in evaluation.review.service.js.
//
// Other rules:
//   • One evaluation per person per period (database unique rule).
//   • Only while the period is OPEN.
//   • Only the active criteria of the right list may be scored; every one must be scored
//     before submitting, and feedback is required.
//   • Each score keeps a copy of the weight used, so later weight changes never alter old results.
//   • Visibility: the person evaluated sees their evaluation only once it is PUBLISHED.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as repository from './evaluation.repository.js';
import { calculateOverallScore, findMissingCriteria } from './evaluation.scoring.js';
import { MIN_FEEDBACK_LENGTH } from './evaluation.validation.js';

const EDITABLE = ['DRAFT', 'RETURNED'];
const CAN_BE_EVALUATED = ['ACTIVE', 'ON_LEAVE'];

// ---------- Who may evaluate ----------

export function isAuthorizedHoldingEvaluator(user) {
  return user.role === 'HOLDING' && (user.isPrimaryHoldingUser || user.canApproveEvaluations);
}

// Throws unless "user" may write the evaluation of a person of this type in this company.
function assertCanEvaluate(user, { type, companyId }) {
  if (type === 'EMPLOYEE') {
    if (user.role === 'MANAGER' && user.companyId && user.companyId === companyId) return;
    throw AppError.forbidden("Employees are evaluated by their own company's Manager.");
  }
  if (isAuthorizedHoldingEvaluator(user)) return;
  throw AppError.forbidden(
    'Managers are evaluated by the primary Holding user or a Holding user they have allowed.',
  );
}

// ---------- Who may read ----------

export async function assertCanRead(user, evaluation) {
  if (user.role === 'HOLDING') return;

  // The person evaluated: only after publication.
  if (evaluation.employee.user.id === user.id) {
    if (evaluation.status === 'PUBLISHED') return;
    throw AppError.forbidden('Your evaluation will be visible once it has been approved and published.');
  }

  // A Manager: the employee evaluations of their own company.
  if (user.role === 'MANAGER' && evaluation.type === 'EMPLOYEE' && evaluation.companyId === user.companyId) return;

  throw AppError.forbidden('You do not have access to this evaluation.');
}

function readScope(user, myEmployeeId) {
  if (user.role === 'HOLDING') return {};
  if (user.role === 'MANAGER') {
    return {
      OR: [
        ...(user.companyId ? [{ type: 'EMPLOYEE', companyId: user.companyId }] : []),
        ...(myEmployeeId ? [{ employeeId: myEmployeeId, status: 'PUBLISHED' }] : []),
      ],
    };
  }
  return { employeeId: myEmployeeId ?? '00000000-0000-0000-0000-000000000000', status: 'PUBLISHED' };
}

// ---------- Response ----------

export async function toResponse(evaluation, user, { withDetails = false } = {}) {
  const scores = evaluation.scores.map((s) => ({
    criterionId: s.criterionId,
    criterion: s.criterion.name,
    weightUsed: Number(s.weightUsed),
    score: s.score,
    comment: s.comment,
  }));

  const response = {
    id: evaluation.id,
    type: evaluation.type,
    status: evaluation.status,
    period: { id: evaluation.period.id, name: evaluation.period.name, status: evaluation.period.status },
    employee: {
      id: evaluation.employee.id,
      employeeNumber: evaluation.employee.employeeNumber,
      firstName: evaluation.employee.firstName,
      lastName: evaluation.employee.lastName,
      role: evaluation.employee.user.role,
    },
    company: { id: evaluation.company.id, name: evaluation.company.name, code: evaluation.company.code },
    evaluator: evaluation.evaluator?.email ?? null,
    overallScore: evaluation.overallScore === null ? null : Number(evaluation.overallScore),
    feedback: evaluation.feedback,
    recommendations: evaluation.recommendations,
    submittedAt: evaluation.submittedAt,
    publishedAt: evaluation.publishedAt,
    publishedBy: evaluation.publishedBy?.email ?? null,
    acknowledgedAt: evaluation.acknowledgedAt,
    employeeComment: evaluation.employeeComment,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
  };

  if (!withDetails) return response;

  response.scores = scores;

  // For the people who write or check the evaluation: what is still missing, and the
  // person's own submitted self-assessment for this period (if any).
  const isPersonEvaluated = evaluation.employee.user.id === user.id;
  if (!isPersonEvaluated) {
    const active = await repository.findActiveCriteria(evaluation.type);
    response.missingCriteria = findMissingCriteria(active, evaluation.scores).map((c) => ({ id: c.id, name: c.name }));
    const selfAssessment = await repository.findSubmittedSelfAssessment(evaluation.employeeId, evaluation.periodId);
    response.selfAssessment = selfAssessment
      ? { id: selfAssessment.id, comments: selfAssessment.comments, submittedAt: selfAssessment.submittedAt }
      : null;
    // The review history (approve / return decisions with their comments) is internal:
    // the evaluator and the Holding see it, the person evaluated does not.
    response.reviews = evaluation.reviews.map((r) => ({
      decision: r.decision,
      comment: r.comment,
      reviewer: r.reviewer.email,
      decidedAt: r.decidedAt,
    }));
  }
  return response;
}

// ---------- Helpers ----------

async function getForEditing(id, user, db) {
  const evaluation = await repository.findById(id, db);
  if (!evaluation) throw AppError.notFound('Evaluation not found.');

  assertCanEvaluate(user, evaluation);
  if (evaluation.period.status !== 'OPEN') {
    throw AppError.conflict(`The period "${evaluation.period.name}" is ${evaluation.period.status}. Evaluations can only be changed while it is open.`);
  }
  if (!EDITABLE.includes(evaluation.status)) {
    throw AppError.conflict(`This evaluation is ${evaluation.status} and can no longer be changed.`);
  }
  return evaluation;
}

// ---------- Reading ----------

export async function listEvaluations(query, user) {
  const me = await repository.findEmployeeByUserId(user.id);
  const { periodId, companyId, employeeId, status, type } = query;

  const where = {
    AND: [
      readScope(user, me?.id),
      {
        ...(periodId && { periodId }),
        ...(companyId && { companyId }),
        ...(employeeId && { employeeId }),
        ...(status && { status }),
        ...(type && { type }),
      },
    ],
  };

  const { items, total } = await repository.findMany(where, toSkipTake(query));
  const responses = await Promise.all(items.map((e) => toResponse(e, user)));
  return { items: responses, pagination: buildPagination(query, total) };
}

export async function getEvaluation(id, user) {
  const evaluation = await repository.findById(id);
  if (!evaluation) throw AppError.notFound('Evaluation not found.');
  await assertCanRead(user, evaluation);
  return toResponse(evaluation, user, { withDetails: true });
}

// ---------- Writing ----------

export async function createEvaluation({ employeeId, periodId }, user) {
  const evaluation = await prisma.$transaction(async (tx) => {
    const employee = await repository.findEmployeeById(employeeId, tx);
    if (!employee) throw AppError.notFound('Employee not found.');
    if (employee.userId === user.id) throw AppError.forbidden('You cannot evaluate yourself.');

    const type = employee.user.role === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE';
    assertCanEvaluate(user, { type, companyId: employee.companyId });

    if (!CAN_BE_EVALUATED.includes(employee.employmentStatus)) {
      throw AppError.conflict(`An employee who is ${employee.employmentStatus} cannot be evaluated.`);
    }

    const period = await repository.findPeriodById(periodId, tx);
    if (!period) throw AppError.notFound('Evaluation period not found.');
    if (period.status !== 'OPEN') {
      throw AppError.conflict(`Evaluations can only be started in an open period. "${period.name}" is ${period.status}.`);
    }

    if (await repository.findByEmployeeAndPeriod(employeeId, periodId, tx)) {
      throw AppError.conflict('This person already has an evaluation for this period.');
    }

    const created = await repository.create(
      // companyId is copied: if the person moves company later, this evaluation stays with this one.
      { employeeId, periodId, companyId: employee.companyId, evaluatorId: user.id, type, status: 'DRAFT' },
      tx,
    );

    await recordAudit(
      { userId: user.id, action: 'EVALUATION_CREATED', entityType: 'Evaluation', entityId: created.id, details: { employeeId, periodId, type } },
      tx,
    );
    return created;
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function saveScores(id, { scores }, user) {
  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getForEditing(id, user, tx);
    const active = await repository.findActiveCriteria(current.type, tx);
    const activeById = new Map(active.map((c) => [c.id, c]));

    // Every score must belong to an active criterion of the right list.
    const problems = scores
      .filter((s) => !activeById.has(s.criterionId))
      .map((s) => ({ field: 'scores', message: `Criterion ${s.criterionId} is not an active ${current.type.toLowerCase()} criterion.` }));
    if (problems.length > 0) throw AppError.badRequest('Some fields are missing or invalid.', problems);

    for (const s of scores) {
      await repository.upsertScore(
        { evaluationId: id, criterionId: s.criterionId, score: s.score, comment: s.comment, weightUsed: activeById.get(s.criterionId).weight },
        tx,
      );
    }

    // Recalculate: the overall score is known only when every active criterion has a score.
    const refreshed = await repository.findById(id, tx);
    const currentScores = refreshed.scores.filter((s) => activeById.has(s.criterionId));
    const complete = findMissingCriteria(active, currentScores).length === 0;
    const updated = await repository.update(id, { overallScore: complete ? calculateOverallScore(currentScores) : null }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'EVALUATION_SCORED',
        entityType: 'Evaluation',
        entityId: id,
        details: { scores: scores.map((s) => ({ criterionId: s.criterionId, score: s.score })) },
      },
      tx,
    );
    return updated;
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function updateEvaluation(id, data, user) {
  const evaluation = await prisma.$transaction(async (tx) => {
    await getForEditing(id, user, tx);
    const updated = await repository.update(id, data, tx);
    await recordAudit(
      { userId: user.id, action: 'EVALUATION_UPDATED', entityType: 'Evaluation', entityId: id, details: { fields: Object.keys(data) } },
      tx,
    );
    return updated;
  });

  return toResponse(evaluation, user, { withDetails: true });
}

export async function submitEvaluation(id, user) {
  const evaluation = await prisma.$transaction(async (tx) => {
    const current = await getForEditing(id, user, tx);
    const active = await repository.findActiveCriteria(current.type, tx);
    const activeIds = active.map((c) => c.id);

    // Scores for criteria that are no longer active (if criteria changed while the period
    // was closed) are removed, so only the current list counts.
    await repository.deleteScoresNotIn(id, activeIds, tx);
    const refreshed = await repository.findById(id, tx);

    const problems = [];
    const missing = findMissingCriteria(active, refreshed.scores);
    if (missing.length > 0) {
      problems.push({ field: 'scores', message: `Score every criterion first. Missing: ${missing.map((c) => c.name).join(', ')}.` });
    }
    if ((refreshed.feedback ?? '').trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push({ field: 'feedback', message: `Write at least ${MIN_FEEDBACK_LENGTH} characters of feedback before submitting.` });
    }
    if (problems.length > 0) throw AppError.badRequest('The evaluation is not complete.', problems);

    const submitted = await repository.update(
      id,
      {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        evaluatorId: user.id, // the person who submits is the evaluator of record
        overallScore: calculateOverallScore(refreshed.scores),
      },
      tx,
    );

    await recordAudit(
      {
        userId: user.id,
        action: 'EVALUATION_SUBMITTED',
        entityType: 'Evaluation',
        entityId: id,
        details: { from: current.status, overallScore: Number(submitted.overallScore) },
      },
      tx,
    );
    return submitted;
  });

  return toResponse(evaluation, user, { withDetails: true });
}
