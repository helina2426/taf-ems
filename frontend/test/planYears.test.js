// Unit tests for the plan-year helpers (src/utils/planYears.js) and the calendar file.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { changedRules, periodRows, rulesFromForm, shortPeriodName } from '../src/utils/planYears.js';

describe('plan-year helpers', () => {
  it('periodRows lists halves, quarters and months in order, with their level', () => {
    const month = (n) => ({ id: `m${n}`, type: 'MONTH', name: `M${n}` });
    const tree = {
      type: 'YEAR',
      children: [{ id: 'h1', type: 'HALF', children: [{ id: 'q1', type: 'QUARTER', children: [month(1), month(2), month(3)] }] }],
    };
    const rows = periodRows(tree);
    assert.deepEqual(rows.map((r) => r.id), ['h1', 'q1', 'm1', 'm2', 'm3']);
    assert.deepEqual(rows.map((r) => r.level), [0, 1, 2, 2, 2]);
    assert.deepEqual(periodRows(null), []);
  });

  it('rulesFromForm turns form text into numbers, and the safety rule into true/false', () => {
    const rules = rulesFromForm({ employeeResultsShare: '70', managerResultsShare: '80', minKpis: '3', maxKpis: '7', minKpiWeight: '10', maxKpiWeight: '40', achievementCap: '120', minMonthsForRating: '6', appealDays: '14', planDeadlineDays: '30', safetyCapEnabled: 1 });
    assert.equal(rules.employeeResultsShare, 70);
    assert.equal(rules.safetyCapEnabled, true);
  });

  it('changedRules keeps only what changed', () => {
    assert.deepEqual(changedRules({ appealDays: 14, minKpis: 3 }, { appealDays: 10, minKpis: 3 }), { appealDays: 10 });
  });

  it('shortPeriodName removes the year name', () => assert.equal(shortPeriodName('2019 EFY · Hamle 2018'), 'Hamle 2018'));
});

describe('the calendar file is the same in the frontend and the backend', () => {
  it('frontend/src/utils/ethiopianCalendar.js = backend/src/shared/ethiopianCalendar.js', () => {
    const frontend = readFileSync(new URL('../src/utils/ethiopianCalendar.js', import.meta.url), 'utf8');
    const backend = readFileSync(new URL('../../backend/src/shared/ethiopianCalendar.js', import.meta.url), 'utf8');
    assert.equal(frontend, backend, 'Copy backend/src/shared/ethiopianCalendar.js to frontend/src/utils/ after changing it.');
  });
});
