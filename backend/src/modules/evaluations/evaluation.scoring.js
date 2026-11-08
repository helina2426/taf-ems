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