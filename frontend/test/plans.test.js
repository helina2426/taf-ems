// Unit tests for the plan helpers (src/utils/plans.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkMonths, defaultPlanYearId, formatNumber, planTitle } from '../src/utils/plans.js';

describe('plan helpers', () => {
  it('planTitle names each level', () => {
    assert.equal(planTitle({ level: 'HOLDING' }), 'Holding plan');
    assert.equal(planTitle({ level: 'COMPANY', company: { name: 'Alpha' } }), 'Company plan · Alpha');
    assert.equal(planTitle({ level: 'INDIVIDUAL', employee: { firstName: 'Dawit', lastName: 'Bekele' } }), 'Plan of Dawit Bekele');
  });

  it('formatNumber adds thousands separators and keeps up to 2 decimals', () => {
    assert.equal(formatNumber(1200), '1,200');
    assert.equal(formatNumber(95.5), '95.5');
    assert.equal(formatNumber(null), '—');
  });

  it('checkMonths: months that add up to the year target are fine', () => {
    assert.equal(checkMonths(Array(12).fill('100'), 1200, 'SUM').message, null);
    assert.match(checkMonths(Array(12).fill('90'), 1200, 'SUM').message, /1,080/);
  });

  it('checkMonths: averages and "last month" KPIs', () => {
    assert.equal(checkMonths(Array(12).fill('95'), 95, 'AVERAGE').message, null);
    assert.match(checkMonths([...Array(11).fill('500'), '400'], 500, 'LAST').message, /12th month/);
    assert.match(checkMonths(['x', ...Array(11).fill('1')], 11, 'SUM').message, /0 or more/);
  });

  it('defaultPlanYearId picks the active year that contains today', () => {
    const years = [
      { id: 'next', status: 'PLANNING', startDate: '2027-07-08', endDate: '2028-07-07' },
      { id: 'now', status: 'ACTIVE', startDate: '2026-07-08', endDate: '2027-07-07' },
    ];
    assert.equal(defaultPlanYearId(years, '2026-11-17'), 'now');
    assert.equal(defaultPlanYearId([], '2026-11-17'), '');
  });
});
