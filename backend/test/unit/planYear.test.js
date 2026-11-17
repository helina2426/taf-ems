// Unit tests for building the 19 periods of a plan year (src/shared/planYear.js)
// and for the plan-year rules (src/modules/plan-years/planYear.rules.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays } from '../../src/shared/ethiopianCalendar.js';
import { buildPlanYear } from '../../src/shared/planYear.js';
import { DEFAULT_RULES, checkRules } from '../../src/modules/plan-years/planYear.rules.js';

const ofType = (year, type) => year.periods.filter((p) => p.type === type);

describe('Ethiopian plan year 2019 EFY', () => {
  const year = buildPlanYear('ETHIOPIAN', 2019);

  it('is called "2019 EFY" and runs from Hamle 1, 2018 to Sene 30, 2019', () => {
    assert.equal(year.name, '2019 EFY');
    assert.equal(year.startDate, '2026-07-08');
    assert.equal(year.endDate, '2027-07-07');
  });

  it('has 19 periods: 1 year, 2 halves, 4 quarters, 12 months', () => {
    assert.equal(year.periods.length, 19);
    assert.deepEqual(['YEAR', 'HALF', 'QUARTER', 'MONTH'].map((t) => ofType(year, t).length), [1, 2, 4, 12]);
  });

  it('the months follow each other with no gap and no overlap', () => {
    const months = ofType(year, 'MONTH');
    assert.equal(months[0].startDate, year.startDate);
    assert.equal(months[11].endDate, year.endDate);
    for (let i = 1; i < months.length; i += 1) assert.equal(months[i].startDate, addDays(months[i - 1].endDate, 1));
  });

  it('Nehase includes Pagume, so the second month ends on Pagume 5 (10 September 2026)', () => {
    const nehase = ofType(year, 'MONTH')[1];
    assert.equal(nehase.name, '2019 EFY · Nehase + Pagume 2018');
    assert.equal(nehase.endDate, '2026-09-10');
  });

  it('Q1 = Hamle, Nehase, Meskerem and H1 = Hamle to Tahsas', () => {
    const [q1] = ofType(year, 'QUARTER');
    const [h1] = ofType(year, 'HALF');
    assert.equal(q1.endDate, '2026-10-10'); // Meskerem 30, 2019
    assert.equal(h1.endDate, '2027-01-08'); // Tahsas 30, 2019
  });

  it('each month points to its quarter, each quarter to its half, each half to the year', () => {
    const months = ofType(year, 'MONTH');
    assert.deepEqual(months.map((m) => m.parentKey), ['Q1', 'Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4']);
    assert.deepEqual(ofType(year, 'QUARTER').map((q) => q.parentKey), ['H1', 'H1', 'H2', 'H2']);
    assert.deepEqual(ofType(year, 'HALF').map((h) => h.parentKey), ['Y', 'Y']);
  });

  it('a year after an Ethiopian leap year gets Pagume 6 (2016 EFY: Nehase ends 11 September 2023)', () => {
    assert.equal(ofType(buildPlanYear('ETHIOPIAN', 2016), 'MONTH')[1].endDate, '2023-09-11');
  });
});

describe('Gregorian plan year', () => {
  const year = buildPlanYear('GREGORIAN', 2028);

  it('runs from 1 January to 31 December, with the normal 12 months', () => {
    assert.equal(year.name, '2028 (GC)');
    assert.equal(year.startDate, '2028-01-01');
    assert.equal(year.endDate, '2028-12-31');
    assert.equal(ofType(year, 'MONTH')[1].endDate, '2028-02-29'); // leap year
  });
});

describe('invalid plan years', () => {
  it('refuses an unknown calendar or a year out of range', () => {
    assert.throws(() => buildPlanYear('JULIAN', 2019), RangeError);
    assert.throws(() => buildPlanYear('ETHIOPIAN', 1999), RangeError);
    assert.throws(() => buildPlanYear('ETHIOPIAN', 2019.5), RangeError);
  });
});

describe('plan-year rules', () => {
  it('the default rules are valid', () => assert.deepEqual(checkRules(DEFAULT_RULES), []));

  it('the minimum cannot be bigger than the maximum', () => {
    const fields = checkRules({ ...DEFAULT_RULES, minKpis: 8, maxKpis: 5 }).map((p) => p.field);
    assert.ok(fields.includes('maxKpis'));
  });

  it('refuses limits that make a plan impossible (3 KPIs × at most 20 points can never reach 70)', () => {
    const fields = checkRules({ ...DEFAULT_RULES, maxKpis: 3, maxKpiWeight: 20 }).map((p) => p.field);
    assert.deepEqual(fields, ['employeeResultsShare', 'managerResultsShare']);
  });
});
