// Unit tests for the version 2 report calculations (Module 19).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { choosePlanYear, ratingDistribution, summarizeLights } from '../../src/modules/reports/report.v2.rules.js';

describe('version 2 reports', () => {
  test('lights: counts and the worst one', () => {
    assert.deepEqual(summarizeLights(['GREEN', 'RED', null, 'YELLOW']), { GREEN: 1, YELLOW: 1, RED: 1, NONE: 1, worst: 'RED' });
    assert.equal(summarizeLights(['GREEN', 'YELLOW']).worst, 'YELLOW');
    assert.equal(summarizeLights(['GREEN']).worst, 'GREEN');
    assert.equal(summarizeLights([null]).worst, null);
  });

  test('rating distribution with percentages', () => {
    const d = ratingDistribution(['SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'SUCCESSFULLY_MEETS', null]);
    assert.equal(d.total, 3);
    assert.equal(d.SUCCESSFULLY_MEETS, 2);
    assert.equal(d.percent.SUCCESSFULLY_MEETS, 66.7);
    assert.equal(d.percent.EXCEEDS, 0);
    assert.equal(ratingDistribution([]).percent.EXCEEDS, 0);
  });

  test('the plan year: the active one that contains today', () => {
    const y = (id, status, start, end) => ({ id, status, startDate: new Date(start), endDate: new Date(end) });
    const cycles = [y('2020', 'PLANNING', '2027-07-08', '2028-07-07'), y('2019', 'ACTIVE', '2026-07-08', '2027-07-07'), y('2018', 'CLOSED', '2025-07-08', '2026-07-07')];
    assert.equal(choosePlanYear(cycles, '2026-11-19').id, '2019');
    assert.equal(choosePlanYear(cycles, '2026-11-19', '2018').id, '2018');
    assert.equal(choosePlanYear(cycles, '2026-11-19', 'nope'), null);
    assert.equal(choosePlanYear([cycles[0]], '2026-11-19').id, '2020');
    assert.equal(choosePlanYear([], '2026-11-19'), null);
  });
});
