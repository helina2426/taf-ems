// Unit tests for target changes during the year (Module 17).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isLocked, resplitTargets } from '../../src/modules/change-requests/changeRequest.rules.js';
import { checkMonthTargets } from '../../src/modules/plans/plan.rules.js';

// 12 months; the first `over` months are locked.
const months = (target, over) => Array.from({ length: 12 }, (_, i) => ({ target, locked: i < over }));

describe('target changes', () => {
  test('a month is locked when it is closed or already over', () => {
    assert.equal(isLocked({ status: 'OPEN', endDate: '2026-11-08' }, '2026-11-19'), true);
    assert.equal(isLocked({ status: 'CLOSED', endDate: '2026-12-08' }, '2026-11-19'), true);
    assert.equal(isLocked({ status: 'OPEN', endDate: '2026-12-08' }, '2026-11-19'), false);
    assert.equal(isLocked({ status: 'UPCOMING', endDate: '2027-01-08' }, '2026-11-19'), false);
  });

  test('SUM: 1,200 → 1,500 after 4 months of 100 → the 8 other months get 137.50', () => {
    const { targets, changedMonths } = resplitTargets(months(100, 4), 1500, { aggregation: 'SUM', direction: 'HIGHER_IS_BETTER' });
    assert.deepEqual(targets.slice(0, 4), [100, 100, 100, 100]);
    assert.deepEqual(targets.slice(4), Array(8).fill(137.5));
    assert.equal(changedMonths, 8);
    assert.equal(checkMonthTargets(targets, 1500, 'SUM'), null);
  });

  test('SUM: the rounding rest goes to the last month', () => {
    const { targets } = resplitTargets(months(100, 5), 1000, { aggregation: 'SUM', direction: 'HIGHER_IS_BETTER' });
    assert.equal(targets.slice(5, 11).every((t) => t === 71.42), true);
    assert.equal(targets[11], 71.48);
    assert.equal(checkMonthTargets(targets, 1000, 'SUM'), null);
  });

  test('SUM: cannot go below what the past months already have', () => {
    const result = resplitTargets(months(100, 6), 500, { aggregation: 'SUM', direction: 'HIGHER_IS_BETTER' });
    assert.match(result.error, /cannot be lower than that/);
  });

  test('AVERAGE: 96% → 97% after 4 months → the 8 other months get 97.5%', () => {
    const { targets } = resplitTargets(months(96, 4), 97, { aggregation: 'AVERAGE', direction: 'HIGHER_IS_BETTER' });
    assert.deepEqual(targets.slice(4), Array(8).fill(97.5));
    assert.equal(checkMonthTargets(targets, 97, 'AVERAGE'), null);
  });

  test('LAST: the remaining months all get the new level', () => {
    const { targets } = resplitTargets(months(500, 3), 650, { aggregation: 'LAST', direction: 'EXACT' });
    assert.deepEqual(targets, [500, 500, 500, ...Array(9).fill(650)]);
    assert.equal(checkMonthTargets(targets, 650, 'LAST'), null);
  });

  test('a "zero is best" KPI and a finished year cannot change', () => {
    assert.match(resplitTargets(months(0, 2), 1, { aggregation: 'SUM', direction: 'ZERO' }).error, /zero is best/);
    assert.match(resplitTargets(months(100, 12), 1300, { aggregation: 'SUM', direction: 'HIGHER_IS_BETTER' }).error, /over or closed/);
  });
});
