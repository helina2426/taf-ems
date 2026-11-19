// Unit tests for the appeal helpers (src/utils/evaluations.js, Module 18).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPEAL_LABEL, newRatingPreview } from '../src/utils/evaluations.js';

describe('appeal helpers', () => {
  it('shows the rating a new score would give, only when it is different', () => {
    assert.equal(newRatingPreview(76, 'PARTIALLY_MEETS'), 'SUCCESSFULLY_MEETS');
    assert.equal(newRatingPreview('50', 'PARTIALLY_MEETS'), 'DOES_NOT_MEET');
    assert.equal(newRatingPreview(70, 'PARTIALLY_MEETS'), null); // same rating
    assert.equal(newRatingPreview('', 'PARTIALLY_MEETS'), null);
  });
  it('has a label for every appeal state', () => {
    assert.deepEqual(Object.keys(APPEAL_LABEL), ['SUBMITTED', 'RATING_KEPT', 'RATING_CHANGED']);
  });
});
