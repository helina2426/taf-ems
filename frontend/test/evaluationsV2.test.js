// Unit tests for the plan-based evaluation helpers (Module 16, src/utils/evaluations.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultEvaluationPeriodId, previewV2, ratingFor } from '../src/utils/evaluations.js';

describe('plan-based evaluation helpers', () => {
  it('uses the same rating bands as the backend (90 / 75 / 55)', () => {
    assert.equal(ratingFor(90), 'EXCEEDS');
    assert.equal(ratingFor(75), 'SUCCESSFULLY_MEETS');
    assert.equal(ratingFor(67.1), 'PARTIALLY_MEETS');
    assert.equal(ratingFor(54.9), 'DOES_NOT_MEET');
  });

  it('previews Dawit\'s mid-year review: 44 + 23.1 = 67.1, Partially meets', () => {
    const behaviours = [
      { criterionId: 's', weightPoints: 6, isSafety: true },
      { criterionId: 'i', weightPoints: 6 },
      { criterionId: 't', weightPoints: 4.5 },
      { criterionId: 'c', weightPoints: 4.5 },
      { criterionId: 'a', weightPoints: 4.5 },
      { criterionId: 'n', weightPoints: 4.5 },
    ];
    const scores = { s: { score: 4 }, i: { score: 4 }, t: { score: 3 }, c: { score: 4 }, a: { score: 5 }, n: { score: 3 } };
    assert.deepEqual(previewV2(44, behaviours, scores), { behaviourScore: 23.1, overallScore: 67.1, rating: 'PARTIALLY_MEETS', safetyCapApplied: false });
    assert.equal(previewV2(null, behaviours, scores), null); // KPI numbers missing
    assert.equal(previewV2(44, behaviours, { s: { score: 4 } }), null); // not every behaviour scored
  });

  it('applies the safety rule in the preview when the plan year switched it on', () => {
    const behaviours = [{ criterionId: 's', weightPoints: 30, isSafety: true }];
    // 70 + 1/5 × 30 = 76 → "Successfully meets", but Safety = 1 → lowered to "Partially meets".
    assert.deepEqual(previewV2(70, behaviours, { s: { score: 1 } }, { safetyCapEnabled: true }), { behaviourScore: 6, overallScore: 76, rating: 'PARTIALLY_MEETS', safetyCapApplied: true });
    // The same scores with the rule switched off.
    assert.equal(previewV2(70, behaviours, { s: { score: 1 } }).rating, 'SUCCESSFULLY_MEETS');
    assert.equal(previewV2(70, behaviours, { s: { score: 5 } }, { safetyCapEnabled: true }).rating, 'EXCEEDS');
  });

  it('opens the mid-year review first while the first half runs, then the annual evaluation', () => {
    const periods = [
      { id: 'mid', kind: 'MID_YEAR', status: 'OPEN', endDate: '2027-01-07' },
      { id: 'year', kind: 'ANNUAL', status: 'OPEN', endDate: '2027-07-07' },
      { id: 'v1', kind: 'VERSION_1', status: 'CLOSED', endDate: '2026-12-31' },
    ];
    assert.equal(defaultEvaluationPeriodId(periods, '2026-11-19'), 'mid');
    assert.equal(defaultEvaluationPeriodId(periods, '2027-02-01'), 'year');
    assert.equal(defaultEvaluationPeriodId([{ id: 'v1', status: 'CLOSED' }]), 'v1');
  });
});
