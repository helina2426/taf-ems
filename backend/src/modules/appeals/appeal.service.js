// The business rules for appeals (version 2, Module 18). The rules themselves are in appeal.rules.js.
//
//   The person evaluated  → appeals (with a reason), once, within 14 days of acknowledging.
//   A Holding approver who did not write or approve the evaluation → decides: rating kept, or changed.
//   The Manager of the company can read the appeals of their employees (not decide).
//   Everything is in the audit log. A decision is final.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { appealDeadline, decisionResult, whyCannotDecide, whyNoAppeal } from './appeal.rules.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));

const evaluationSelect = {
  id: true,
  type: true,
  status: true,
  rating: true,
  overallScore: true,
  acknowledgedAt: true,
  evaluatorId: true,
  companyId: true,
  employeeId: true,
  employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
  company: { select: { id: true, name: true } },
  period: { select: { name: true, type: true, cycle: { select: { name: true, appealDays: true } } } },
  reviews: { where: { decision: 'APPROVED' }, select: { reviewerId: true } },
};

const appealInclude = { decidedBy: { select: { email: true } }, evaluation: { select: evaluationSelect } };

// The data appeal.rules.js needs to know who may decide.
export function decideContext(evaluation) {
  return {
    evaluatorId: evaluation.evaluatorId,
    approverIds: evaluation.reviews.filter((r) => !r.decision || r.decision === 'APPROVED').map((r) => r.reviewerId),
  };
}

// The appeal as shown on screen. `evaluation` must include its approving reviews.
export function toAppealResponse(appeal, evaluation, user) {
  if (!appeal) return null;
  const cannot = whyCannotDecide(user, decideContext(evaluation));
  return {
    id: appeal.id,
    status: appeal.status,
    reason: appeal.reason,
    originalRating: appeal.originalRating,
    originalScore: num(appeal.originalScore),
    outcome: appeal.outcome,
    newRating: appeal.newRating,
    newScore: num(appeal.newScore),
    decisionComment: appeal.decisionComment,
    decidedBy: appeal.decidedBy?.email ?? null,
    decidedAt: appeal.decidedAt,
    createdAt: appeal.createdAt,
    can: { decide: appeal.status === 'SUBMITTED' && !cannot },
    // Shown to approvers who may not decide, so they know why (e.g. "you approved this evaluation").
    whyCannotDecide: appeal.status === 'SUBMITTED' && user.role === 'HOLDING' ? cannot : null,
  };
}

// For the evaluation page: may the person appeal, and until when?
export function appealInfo(evaluation, appealDays, user) {
  const isPerson = evaluation.employee.user?.id === user.id || evaluation.employee.userId === user.id;
  const deadline = appealDeadline(evaluation.acknowledgedAt, appealDays);
  const why = whyNoAppeal({
    status: evaluation.status,
    rating: evaluation.rating,
    acknowledgedAt: evaluation.acknowledgedAt,
    hasAppeal: Boolean(evaluation.appeal),
    appealDays,
  });
  return { canAppeal: isPerson && !why, appealDeadline: evaluation.rating ? deadline : null };
}

// ---------- The person evaluated appeals ----------

export async function createAppeal(evaluationId, { reason }, user) {
  const appeal = await prisma.$transaction(async (tx) => {
    const evaluation = await tx.evaluation.findUnique({ where: { id: evaluationId }, select: { ...evaluationSelect, appeal: { select: { id: true } } } });
    if (!evaluation) throw AppError.notFound('Evaluation not found.');
    if (evaluation.employee.userId !== user.id) throw AppError.forbidden('Only the person evaluated can appeal their evaluation.');

    const why = whyNoAppeal({
      status: evaluation.status,
      rating: evaluation.rating,
      acknowledgedAt: evaluation.acknowledgedAt,
      hasAppeal: Boolean(evaluation.appeal),
      appealDays: evaluation.period.cycle?.appealDays ?? 14,
    });
    if (why) throw AppError.conflict(why);

    const created = await tx.evaluationAppeal.create({
      data: { evaluationId, reason, originalRating: evaluation.rating, originalScore: evaluation.overallScore },
      include: appealInclude,
    });
    await recordAudit(
      { userId: user.id, action: 'APPEAL_SUBMITTED', entityType: 'EvaluationAppeal', entityId: created.id, details: { evaluationId, rating: evaluation.rating } },
      tx,
    );
    return created;
  });
  return toAppealResponse(appeal, appeal.evaluation, user);
}

// ---------- An independent approver decides ----------

export async function decideAppeal(id, data, user) {
  const appeal = await prisma.$transaction(async (tx) => {
    const current = await tx.evaluationAppeal.findUnique({ where: { id }, include: appealInclude });
    if (!current) throw AppError.notFound('Appeal not found.');
    const cannot = whyCannotDecide(user, decideContext(current.evaluation));
    if (cannot) throw AppError.forbidden(cannot);
    if (current.status !== 'SUBMITTED') throw AppError.conflict('This appeal has already been decided. The decision is final.');

    const result = decisionResult(data, current.originalRating);
    if (result.error) throw AppError.badRequest('Some fields are missing or invalid.', [{ field: 'newScore', message: result.error }]);

    // Only if it is still waiting (two approvers deciding at once: the second gets 409).
    const { count } = await tx.evaluationAppeal.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'DECIDED', ...result, decisionComment: data.comment, decidedById: user.id, decidedAt: new Date() },
    });
    if (count === 0) throw AppError.conflict('This appeal was just decided by someone else.');

    // A changed rating replaces the evaluation's rating and score (the original stays in the appeal).
    if (result.outcome === 'RATING_CHANGED') {
      await tx.evaluation.update({ where: { id: current.evaluationId }, data: { rating: result.newRating, overallScore: result.newScore } });
    }
    await recordAudit(
      {
        userId: user.id,
        action: 'APPEAL_DECIDED',
        entityType: 'EvaluationAppeal',
        entityId: id,
        details: { evaluationId: current.evaluationId, outcome: result.outcome, from: current.originalRating, to: result.newRating ?? current.originalRating },
      },
      tx,
    );
    return tx.evaluationAppeal.findUnique({ where: { id }, include: appealInclude });
  });
  return toAppealResponse(appeal, appeal.evaluation, user);
}

// ---------- Reading ----------

export async function listAppeals({ status }, user) {
  // The Holding: all. A Manager: their company's employee evaluations. Anyone: their own.
  const own = { evaluation: { employee: { userId: user.id } } };
  let scope = own;
  if (user.role === 'HOLDING') scope = {};
  if (user.role === 'MANAGER') scope = { OR: [own, { evaluation: { type: 'EMPLOYEE', companyId: user.companyId ?? '00000000-0000-0000-0000-000000000000' } }] };

  const items = await prisma.evaluationAppeal.findMany({
    where: { AND: [scope, status ? { status } : {}] },
    include: appealInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return {
    items: items.map((a) => ({
      ...toAppealResponse(a, a.evaluation, user),
      evaluation: {
        id: a.evaluation.id,
        type: a.evaluation.type,
        employee: { id: a.evaluation.employee.id, firstName: a.evaluation.employee.firstName, lastName: a.evaluation.employee.lastName },
        company: a.evaluation.company,
        period: a.evaluation.period.cycle ? `${a.evaluation.period.cycle.name} — ${a.evaluation.period.type === 'YEAR' ? 'annual evaluation' : 'mid-year review'}` : a.evaluation.period.name,
      },
    })),
    waiting: items.filter((a) => a.status === 'SUBMITTED').length,
  };
}
