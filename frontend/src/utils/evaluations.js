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

// ---------- Version 2 (Module 16): plan-based evaluations ----------

export const KIND_LABEL = { MID_YEAR: 'Mid-year review', ANNUAL: 'Annual evaluation' };

// The UN-style rating.
export const RATING_LABEL = {
  EXCEEDS: 'Exceeds expectations',
  SUCCESSFULLY_MEETS: 'Successfully meets',
  PARTIALLY_MEETS: 'Partially meets',
  DOES_NOT_MEET: 'Does not meet',
};
export const RATING_TONE = { EXCEEDS: 'good', SUCCESSFULLY_MEETS: 'good', PARTIALLY_MEETS: 'warn', DOES_NOT_MEET: 'bad' };

// The same bands as the backend: 90 / 75 / 55.
export function ratingFor(overall) {
  if (overall === null || overall === undefined) return null;
  if (overall >= 90) return 'EXCEEDS';
  if (overall >= 75) return 'SUCCESSFULLY_MEETS';
  if (overall >= 55) return 'PARTIALLY_MEETS';
  return 'DOES_NOT_MEET';
}

// The period to show first on the evaluations page: the open mid-year review while the first half
// is running, otherwise the open annual evaluation, otherwise any open period, otherwise the first one.
export function defaultEvaluationPeriodId(periods, today = new Date().toISOString().slice(0, 10)) {
  const open = periods.filter((p) => p.status === 'OPEN');
  const mid = open.find((p) => p.kind === 'MID_YEAR' && p.endDate >= today);
  const annual = open.find((p) => p.kind === 'ANNUAL');
  return (mid ?? annual ?? open[0] ?? periods[0])?.id ?? '';
}

// A preview of a plan-based evaluation while behaviours are being scored (the saved numbers
// always come from the backend). KPI points are calculated by the backend (ev.resultsScore).
//   behaviours = [{ criterionId, weightPoints, isSafety }], scores = { criterionId: { score } }
export function previewV2(resultsScore, behaviours, scores, { safetyCapEnabled = false } = {}) {
  if (resultsScore === null || resultsScore === undefined) return null;
  if (behaviours.length === 0 || behaviours.some((b) => !scores[b.criterionId]?.score)) return null;
  const behaviourScore = Math.round(behaviours.reduce((sum, b) => sum + (Number(scores[b.criterionId].score) / 5) * b.weightPoints, 0) * 100) / 100;
  const overallScore = Math.round((resultsScore + behaviourScore) * 100) / 100;
  let rating = ratingFor(overallScore);
  const safety = behaviours.find((b) => b.isSafety);
  const capped = safetyCapEnabled && safety && Number(scores[safety.criterionId].score) === 1 && ['EXCEEDS', 'SUCCESSFULLY_MEETS'].includes(rating);
  if (capped) rating = 'PARTIALLY_MEETS';
  return { behaviourScore, overallScore, rating, safetyCapApplied: Boolean(capped) };
}

// ---------- Version 2 (Module 18): appeals ----------

// The badge of an appeal (appealStatus = SUBMITTED, RATING_KEPT or RATING_CHANGED).
export const APPEAL_LABEL = {
  SUBMITTED: { label: 'Appeal waiting', tone: 'info' },
  RATING_KEPT: { label: 'Appeal: rating kept', tone: 'neutral' },
  RATING_CHANGED: { label: 'Appeal: rating changed', tone: 'good' },
};

// The rating a new score would give, for the decision form ("76 → Successfully meets").
// Returns null when the score is missing, or when it gives the same rating as before.
export function newRatingPreview(score, originalRating) {
  if (score === '' || score === null || score === undefined || Number.isNaN(Number(score))) return null;
  const rating = ratingFor(Number(score));
  return rating === originalRating ? null : rating;
}
