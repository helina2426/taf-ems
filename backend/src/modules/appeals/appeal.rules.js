// The rules of appeals (version 2, Module 18). Pure functions, unit-tested (test/unit/appealRules.test.js).
//
//   • Only the person evaluated can appeal, and only a PUBLISHED plan-based evaluation
//     rated "Partially meets" or "Does not meet" (good ratings are not appealed).
//   • First they acknowledge it ("I have read it"); then they have appealDays (14) to appeal.
//   • One appeal per evaluation.
//   • ONE Holding approver decides — someone who did NOT write and did NOT approve that evaluation,
//     so the decision is independent. (The UN uses a panel of three; Taf has too few Holding users.)
//   • The decision is final: the rating is kept, or changed to a new score (and its rating).

import { ratingFor } from '../evaluations/evaluation.scoring.js';

export const APPEALABLE = ['PARTIALLY_MEETS', 'DOES_NOT_MEET'];
const DAY = 24 * 60 * 60 * 1000;

// The last moment to appeal: appealDays after the acknowledgement.
export function appealDeadline(acknowledgedAt, appealDays) {
  return acknowledgedAt ? new Date(acknowledgedAt.getTime() + appealDays * DAY) : null;
}

// Why this evaluation cannot be appealed now — or null when it can.
export function whyNoAppeal({ status, rating, acknowledgedAt, hasAppeal, appealDays, now = new Date() }) {
  if (hasAppeal) return 'This evaluation has already been appealed. There is one appeal per evaluation.';
  if (status !== 'PUBLISHED' || !rating) return 'Only a published plan-based evaluation can be appealed.';
  if (!APPEALABLE.includes(rating)) return 'Only a rating of "Partially meets" or "Does not meet" can be appealed.';
  if (!acknowledgedAt) return 'Acknowledge the evaluation first (that you have read it); then you can appeal.';
  if (now > appealDeadline(acknowledgedAt, appealDays)) return `The ${appealDays} days to appeal are over.`;
  return null;
}

// Why this user cannot decide the appeal — or null when they can.
//   evaluation = { evaluatorId, approverIds: [users who approved it] }
export function whyCannotDecide(user, evaluation) {
  const approver = user.role === 'HOLDING' && (user.isPrimaryHoldingUser || user.canApproveEvaluations);
  if (!approver) return 'Only a Holding user who can approve evaluations decides appeals.';
  if (evaluation.evaluatorId === user.id) return 'You wrote this evaluation, so another approver must decide the appeal.';
  if (evaluation.approverIds.includes(user.id)) return 'You approved this evaluation, so another approver must decide the appeal.';
  return null;
}

// A decision → what to save. Returns { outcome, newRating, newScore } or { error }.
export function decisionResult({ outcome, newScore }, originalRating) {
  if (outcome === 'RATING_KEPT') return { outcome, newRating: null, newScore: null };
  if (newScore === undefined || newScore === null) return { error: 'Give the new score (0–100).' };
  const newRating = ratingFor(newScore);
  if (newRating === originalRating) {
    return { error: `A score of ${newScore} still gives the same rating. To keep the rating, choose "Rating kept".` };
  }
  return { outcome, newRating, newScore };
}
