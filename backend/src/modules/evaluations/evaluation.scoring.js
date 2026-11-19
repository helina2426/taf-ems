// The score calculation, kept in its own small file so it is easy to read and test.
//
// Each criterion is scored from 1 to 5. A score of 5 means "full marks" for that criterion.
// The overall score is a percentage:
//
//     overall = Σ ( score ÷ 5 × weight )
//
// Example: weights 30, 25, 20, 25 and scores 4, 5, 3, 4
//     = 4/5×30 + 5/5×25 + 3/5×20 + 4/5×25
//     = 24 + 25 + 12 + 20
//     = 81%

export const MAX_SCORE = 5;

export function calculateOverallScore(scores) {
  const total = scores.reduce((sum, s) => sum + (s.score / MAX_SCORE) * Number(s.weightUsed), 0);
  return Math.round(total * 100) / 100; // keep 2 decimals
}

// Which active criteria still have no score.
export function findMissingCriteria(activeCriteria, scores) {
  const scored = new Set(scores.map((s) => s.criterionId));
  return activeCriteria.filter((c) => !scored.has(c.id));
}
// ============================================================================
// Version 2 (Module 16): plan-based evaluations.
//
//   For each KPI of the person's plan (the company plan for a Manager):
//       achievement %  = confirmed actual ÷ target of the same months, by direction, at most 120%
//                        (the same calculation as the traffic lights: progress.rules.js)
//       score 1–5      = 110%+ → 5 · 100–109 → 4 · 85–99 → 3 · 70–84 → 2 · below 70 → 1
//       points         = score ÷ 5 × weight                         (weights add up to 70 or 80)
//   For each behaviour:
//       points         = score ÷ 5 × (weight% × behaviour part)     (behaviour part = 30 or 20)
//   overall = KPI points + behaviour points                          (out of 100)
//   rating  = 90+ Exceeds · 75–89 Successfully meets · 55–74 Partially meets · below 55 Does not meet
//   safety rule (if the plan year switched it on): Safety = 1 → the rating is at most "Partially meets".
// ============================================================================

const round2 = (value) => Math.round(value * 100) / 100;

// Achievement % → score 1 to 5.
export function kpiScore(achievementPercent) {
  if (achievementPercent === null || achievementPercent === undefined) return null;
  if (achievementPercent >= 110) return 5;
  if (achievementPercent >= 100) return 4;
  if (achievementPercent >= 85) return 3;
  if (achievementPercent >= 70) return 2;
  return 1;
}

// A score 1–5 → points, out of the weight (in points).
export function pointsFor(score, weightPoints) {
  return round2((score / MAX_SCORE) * weightPoints);
}

// A behaviour's weight (% of its list) → points out of the behaviour part (30 or 20).
//   Safety 20% of 30 points = 6 points.
export function behaviourWeightPoints(weightPercent, behaviourPart) {
  return round2((Number(weightPercent) * behaviourPart) / 100);
}

export const RATINGS = ['EXCEEDS', 'SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET'];

export function ratingFor(overallScore) {
  if (overallScore === null || overallScore === undefined) return null;
  if (overallScore >= 90) return 'EXCEEDS';
  if (overallScore >= 75) return 'SUCCESSFULLY_MEETS';
  if (overallScore >= 55) return 'PARTIALLY_MEETS';
  return 'DOES_NOT_MEET';
}

// The safety rule: a 1 in the Safety behaviour limits the rating to "Partially meets".
export function applySafetyCap(rating, safetyScore, enabled) {
  const capped = enabled && safetyScore === 1 && (rating === 'EXCEEDS' || rating === 'SUCCESSFULLY_MEETS');
  return { rating: capped ? 'PARTIALLY_MEETS' : rating, safetyCapApplied: capped };
}

// The whole calculation. kpis = [{ weight, score }] (score null = no confirmed number yet),
// behaviours = [{ weightPoints, score, isSafety }] (score null = not scored yet).
// The totals are only known when every KPI and every behaviour has a score.
export function evaluationTotals({ kpis, behaviours, safetyCapEnabled = false }) {
  const kpiDone = kpis.length > 0 && kpis.every((k) => k.score !== null && k.score !== undefined);
  const behaviourDone = behaviours.length > 0 && behaviours.every((b) => b.score !== null && b.score !== undefined);
  const resultsScore = kpiDone ? round2(kpis.reduce((sum, k) => sum + pointsFor(k.score, k.weight), 0)) : null;
  const behaviourScore = behaviourDone ? round2(behaviours.reduce((sum, b) => sum + pointsFor(b.score, b.weightPoints), 0)) : null;
  if (resultsScore === null || behaviourScore === null) {
    return { resultsScore, behaviourScore, overallScore: null, rating: null, safetyCapApplied: false };
  }
  const overallScore = round2(resultsScore + behaviourScore);
  const safety = behaviours.find((b) => b.isSafety);
  return { resultsScore, behaviourScore, overallScore, ...applySafetyCap(ratingFor(overallScore), safety?.score, safetyCapEnabled) };
}

// The 6-month rule (annual evaluation): count the FULL months of the plan year the person worked,
// i.e. the months that started on or after their first day. With no hire date, every month counts.
//   months = [{ startDate }] (dates), hireDate = a date or null.
export function monthsInYear(months, hireDate) {
  if (!hireDate) return months.length;
  const first = hireDate.toISOString().slice(0, 10);
  return months.filter((m) => m.startDate.toISOString().slice(0, 10) >= first).length;
}
