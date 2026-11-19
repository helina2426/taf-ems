// Unit tests for the plan and KPI rules (src/modules/plans/plan.rules.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cascadeWarning, checkMonthTargets, checkPlanReady, splitYearTarget } from '../../src/modules/plans/plan.rules.js';

const rules = { employeeResultsShare: 70, managerResultsShare: 80, minKpis: 3, maxKpis: 7, minKpiWeight: 10, maxKpiWeight: 40 };
const kpi = (name, perspective, weight, parentKpiId = 'parent') => ({ name, perspective, weight, parentKpiId });

describe('splitting a year target into 12 months', () => {
  it('SUM: 1,200 deliveries → 100 every month', () => assert.deepEqual(splitYearTarget(1200, 'SUM', 'HIGHER_IS_BETTER'), Array(12).fill(100)));

  it('SUM: the rounding rest goes to the last month, so the months still add up exactly', () => {
    const months = splitYearTarget(1000, 'SUM', 'HIGHER_IS_BETTER');
    assert.equal(months[0], 83.33);
    assert.equal(months[11], 83.37);
    assert.equal(Math.round(months.reduce((a, b) => a + b, 0) * 100) / 100, 1000);
  });

  it('AVERAGE: 95% on time → 95% every month', () => assert.deepEqual(splitYearTarget(95, 'AVERAGE', 'HIGHER_IS_BETTER'), Array(12).fill(95)));
  it('LAST: a level → the same level every month', () => assert.deepEqual(splitYearTarget(500, 'LAST', 'EXACT'), Array(12).fill(500)));
  it('ZERO: accidents → 0 every month', () => assert.deepEqual(splitYearTarget(0, 'SUM', 'ZERO'), Array(12).fill(0)));
});

describe('checking monthly targets typed by hand', () => {
  const uneven = [80, 80, 90, 100, 100, 110, 120, 120, 100, 100, 100, 100]; // adds up to 1,200
  it('SUM: accepts months that add up to the year target', () => assert.equal(checkMonthTargets(uneven, 1200, 'SUM'), null));
  it('SUM: refuses months that do not add up', () => assert.match(checkMonthTargets(Array(12).fill(90), 1200, 'SUM'), /add up to 1080/));
  it('AVERAGE: the average of the months must be the year target', () => {
    assert.equal(checkMonthTargets([...Array(6).fill(94), ...Array(6).fill(96)], 95, 'AVERAGE'), null);
    assert.match(checkMonthTargets(Array(12).fill(90), 95, 'AVERAGE'), /average/);
  });
  it('LAST: the 12th month must be the year target', () => assert.match(checkMonthTargets(Array(12).fill(400), 500, 'LAST'), /12th month/));
  it('refuses 11 months or a negative number', () => {
    assert.match(checkMonthTargets(Array(11).fill(100), 1100, 'SUM'), /exactly 12/);
    assert.match(checkMonthTargets([-1, ...Array(11).fill(100)], 1099, 'SUM'), /0 or more/);
  });
});

describe('is a plan ready?', () => {
  it('a Holding plan needs at least one KPI, and nothing else', () => {
    assert.deepEqual(checkPlanReady('HOLDING', [], rules), ['Add at least one KPI.']);
    assert.deepEqual(checkPlanReady('HOLDING', [kpi('Revenue', 'FINANCIAL', null, null)], rules), []);
  });

  it('a complete employee plan (3 KPIs, 30 + 20 + 20 = 70 points) is ready', () => {
    const kpis = [kpi('Deliveries', 'INTERNAL_PROCESS', 30), kpi('On time', 'CUSTOMER', 20), kpi('Safety', 'INTERNAL_PROCESS', 20)];
    assert.deepEqual(checkPlanReady('INDIVIDUAL', kpis, rules), []);
  });

  it('an employee plan whose weights do not reach 70 is not ready', () => {
    const problems = checkPlanReady('INDIVIDUAL', [kpi('A', 'FINANCIAL', 30), kpi('B', 'CUSTOMER', 20), kpi('C', 'CUSTOMER', 10)], rules);
    assert.ok(problems.some((p) => p.includes('add up to 60')));
  });

  it('too few KPIs, a weight out of range and a missing link are all reported', () => {
    const problems = checkPlanReady('INDIVIDUAL', [kpi('A', 'FINANCIAL', 50, null), kpi('B', 'CUSTOMER', 20)], rules);
    assert.ok(problems.some((p) => p.includes('between 3 and 7')));
    assert.ok(problems.some((p) => p.includes('"A" weighs 50')));
    assert.ok(problems.some((p) => p.includes('"A" is not linked')));
  });

  it('a company plan must cover all four perspectives and reach 80 points', () => {
    const kpis = [kpi('Revenue', 'FINANCIAL', 30), kpi('On time', 'CUSTOMER', 30), kpi('Deliveries', 'INTERNAL_PROCESS', 10)]; // 70 points
    const problems = checkPlanReady('COMPANY', kpis, rules);
    assert.ok(problems.some((p) => p.includes('Missing: Learning & growth')));
    assert.ok(problems.some((p) => p.includes('must add up to 80')));
  });
});

describe('do the linked KPIs reach the target above?', () => {
  const parent = { aggregation: 'SUM', yearTarget: 2400 };
  it('warns when the employees\' targets add up to less', () => {
    assert.match(cascadeWarning(parent, [{ yearTarget: 1200 }, { yearTarget: 800 }]), /add up to 2000/);
  });
  it('is quiet when they reach it, when nothing is linked yet, or for a percentage', () => {
    assert.equal(cascadeWarning(parent, [{ yearTarget: 1200 }, { yearTarget: 1200 }]), null);
    assert.equal(cascadeWarning(parent, []), null);
    assert.equal(cascadeWarning({ aggregation: 'AVERAGE', yearTarget: 95 }, [{ yearTarget: 90 }]), null);
  });
});
