// Unit tests for the target-change preview (src/utils/targetChanges.js) — the same rule as the backend.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { previewChange } from '../src/utils/targetChanges.js';

const months = (target) => Array.from({ length: 12 }, (_, i) => ({ target, endDate: `2027-${String(i + 1).padStart(2, '0')}-07` }));

describe('target change preview', () => {
  it('keeps the months that are over and shares the rest', () => {
    const { targets, changed, firstChanged } = previewChange({ aggregation: 'SUM', direction: 'HIGHER_IS_BETTER', months: months(100) }, 1500, '2027-04-20');
    assert.deepEqual(targets.slice(0, 4), [100, 100, 100, 100]);
    assert.deepEqual(targets.slice(4), Array(8).fill(137.5));
    assert.equal(changed, 8);
    assert.equal(firstChanged, 4);
  });

  it('averages and levels', () => {
    assert.deepEqual(previewChange({ aggregation: 'AVERAGE', direction: 'HIGHER_IS_BETTER', months: months(96) }, 97, '2027-04-20').targets.slice(4), Array(8).fill(97.5));
    assert.deepEqual(previewChange({ aggregation: 'LAST', direction: 'EXACT', months: months(500) }, 650, '2027-10-01').targets.slice(9), [650, 650, 650]);
  });

  it('explains what cannot be done', () => {
    assert.match(previewChange({ aggregation: 'SUM', direction: 'HIGHER_IS_BETTER', months: months(100) }, 100, '2027-04-20').error, /cannot be lower/);
    assert.match(previewChange({ aggregation: 'SUM', direction: 'ZERO', months: months(0) }, 1).error, /zero is best/);
    assert.match(previewChange({ aggregation: 'SUM', direction: 'HIGHER_IS_BETTER', months: months(100) }, 1300, '2028-01-01').error, /over/);
  });
});
