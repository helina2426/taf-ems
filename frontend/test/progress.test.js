// Unit tests for the progress helpers (src/utils/progress.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultMonthId, parentsOf, summaryColumns, waitingInMonth } from '../src/utils/progress.js';

const periods = [
  { id: 'Y', type: 'YEAR', sequence: 1, status: 'OPEN', parentId: null },
  { id: 'H1', type: 'HALF', sequence: 1, status: 'OPEN', parentId: 'Y' },
  { id: 'Q1', type: 'QUARTER', sequence: 1, status: 'OPEN', parentId: 'H1' },
  { id: 'M1', type: 'MONTH', sequence: 1, status: 'CLOSED', parentId: 'Q1' },
  { id: 'M2', type: 'MONTH', sequence: 2, status: 'OPEN', parentId: 'Q1' },
  { id: 'M3', type: 'MONTH', sequence: 3, status: 'UPCOMING', parentId: 'Q1' },
];

describe('progress helpers', () => {
  it('starts on the last open month', () => assert.equal(defaultMonthId(periods), 'M2'));
  it('finds the quarter and half of a month', () => {
    const { quarter, half } = parentsOf(periods, 'M2');
    assert.equal(quarter.id, 'Q1');
    assert.equal(half.id, 'H1');
  });
  it('orders the summary columns: quarters, halves, then the year', () => {
    assert.deepEqual(summaryColumns(periods).map((c) => c.label), ['Q1', 'H1', 'Year']);
  });
  it('counts the numbers of a month that wait for confirmation', () => {
    const kpis = [{ months: [{ periodId: 'M2', state: 'ENTERED' }] }, { months: [{ periodId: 'M2', state: 'CONFIRMED' }] }];
    assert.equal(waitingInMonth(kpis, 'M2'), 1);
  });
});
