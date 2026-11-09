// Shared knowledge about evaluations, used by several pages.

export const EVALUATION_STATUSES = ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'PUBLISHED'];

export const STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Waiting for approval',
  RETURNED: 'Returned to fix',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
};

export const STATUS_TONE = { DRAFT: 'neutral', SUBMITTED: 'info', RETURNED: 'warn', APPROVED: 'good', PUBLISHED: 'good' };

// The primary Holding user, or a Holding user they allowed. (The backend checks this again.)
export function isApprover(user) {
  return user.role === 'HOLDING' && (user.isPrimaryHoldingUser || user.canApproveEvaluations);
}

// May this user fill in (score, feedback, submit) this evaluation right now?
export function canWrite(user, evaluation) {
  const editable = ['DRAFT', 'RETURNED'].includes(evaluation.status) && evaluation.period.status === 'OPEN';
  const rightPerson =
    (evaluation.type === 'EMPLOYEE' && user.role === 'MANAGER') || (evaluation.type === 'MANAGER' && isApprover(user));
  return editable && rightPerson;
}

// The same formula as the backend: Σ (score ÷ 5 × weight), rounded to 2 decimals.
// Used only as a preview while typing — the saved number always comes from the backend.
export function previewScore(criteria, scores) {
  if (criteria.length === 0 || criteria.some((c) => !scores[c.id]?.score)) return null;
  const total = criteria.reduce((sum, c) => sum + (Number(scores[c.id].score) / 5) * c.weight, 0);
  return Math.round(total * 100) / 100;
}
