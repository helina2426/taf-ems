// Unit tests for the score formula (evaluation.scoring.js).
// A "unit test" checks one small piece of code on its own, without a server or a database.
// Run them with:  npm run test:unit

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateOverallScore, findMissingCriteria } from '../../src/modules/evaluations/evaluation.scoring.js';

describe('calculateOverallScore', () => {
  it('gives 81% for the example in the documentation (4, 5, 3, 4 with weights 30, 25, 20, 25)', () => {
    const scores = [
      { score: 4, weightUsed: 30 },
      { score: 5, weightUsed: 25 },
      { score: 3, weightUsed: 20 },
      { score: 4, weightUsed: 25 },
    ];
    assert.equal(calculateOverallScore(scores), 81);
  });

  it('gives 100% when every score is 5', () => {
    const scores = [30, 25, 20, 25].map((weightUsed) => ({ score: 5, weightUsed }));
    assert.equal(calculateOverallScore(scores), 100);
  });

  it('gives 20% when every score is 1 (the lowest possible)', () => {
    const scores = [30, 25, 20, 25].map((weightUsed) => ({ score: 1, weightUsed }));
    assert.equal(calculateOverallScore(scores), 20);
  });

  it('accepts weights stored as text (the database returns decimals as text)', () => {
    assert.equal(calculateOverallScore([{ score: 4, weightUsed: '50.00' }, { score: 2, weightUsed: '50.00' }]), 60);
  });

  it('rounds to 2 decimals', () => {
    // 3/5 × 33.33 + 4/5 × 33.33 + 5/5 × 33.34 = 19.998 + 26.664 + 33.34 = 80.002 → 80
    const scores = [
      { score: 3, weightUsed: 33.33 },
      { score: 4, weightUsed: 33.33 },
      { score: 5, weightUsed: 33.34 },
    ];
    assert.equal(calculateOverallScore(scores), 80);
  });
});

describe('findMissingCriteria', () => {
  const criteria = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('lists the criteria that have no score yet', () => {
    assert.deepEqual(findMissingCriteria(criteria, [{ criterionId: 'b' }]), [{ id: 'a' }, { id: 'c' }]);
  });

  it('returns an empty list when everything is scored', () => {
    const scores = criteria.map((c) => ({ criterionId: c.id }));
    assert.deepEqual(findMissingCriteria(criteria, scores), []);
  });
});
