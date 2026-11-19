// Unit tests for progress: totals, achievement % and traffic lights (src/modules/progress/progress.rules.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { achievement, aggregate, periodProgress, trafficLight } from '../../src/modules/progress/progress.rules.js';

describe('adding months up', () => {
  it('SUM adds, AVERAGE averages, LAST takes the last month', () => {
    assert.equal(aggregate([100, 104, 96], 'SUM'), 300);
    assert.equal(aggregate([92, 95, 98], 'AVERAGE'), 95);
    assert.equal(aggregate([480, 510, 500], 'LAST'), 500);
    assert.equal(aggregate([], 'SUM'), null);
  });
});

describe('achievement %', () => {
  it('higher is better: 315 of 300 → 105%', () => assert.equal(achievement(300, 315, 'HIGHER_IS_BETTER'), 105));
  it('lower is better: fuel loss target 200, actual 250 → 80%', () => assert.equal(achievement(200, 250, 'LOWER_IS_BETTER'), 80));
  it('exact is best: target 500, actual 450 → 90%', () => assert.equal(achievement(500, 450, 'EXACT'), 90));
  it('zero is best: 0 → 100%, 1 → 50%, 3 → 0%', () => {
    assert.equal(achievement(0, 0, 'ZERO'), 100);
    assert.equal(achievement(0, 1, 'ZERO'), 50);
    assert.equal(achievement(0, 3, 'ZERO'), 0);
  });
  it('never more than the cap (120%)', () => {
    assert.equal(achievement(100, 300, 'HIGHER_IS_BETTER'), 120);
    assert.equal(achievement(100, 300, 'HIGHER_IS_BETTER', 150), 150);
  });
  it('no actual number → no achievement', () => assert.equal(achievement(100, null, 'HIGHER_IS_BETTER'), null));
});

describe('traffic light', () => {
  it('100% or more is green, 85–99% yellow, below 85% red', () => {
    assert.equal(trafficLight(105), 'GREEN');
    assert.equal(trafficLight(100), 'GREEN');
    assert.equal(trafficLight(90), 'YELLOW');
    assert.equal(trafficLight(84.9), 'RED');
    assert.equal(trafficLight(null), null);
  });
});

describe('progress of a quarter', () => {
  const deliveries = { aggregation: 'SUM', direction: 'HIGHER_IS_BETTER' };

  it('only confirmed months count, and the target is taken over the same months ("so far")', () => {
    const months = [
      { target: 100, actual: 104, confirmed: true },
      { target: 100, actual: 98, confirmed: true },
      { target: 100, actual: 60, confirmed: false }, // entered, not checked yet
    ];
    const p = periodProgress(months, deliveries);
    assert.equal(p.target, 300);
    assert.equal(p.targetSoFar, 200);
    assert.equal(p.actual, 202);
    assert.equal(p.achievement, 101);
    assert.equal(p.light, 'GREEN');
    assert.equal(p.monthsKnown, 2);
  });

  it('with no confirmed month there is no light yet', () => {
    const p = periodProgress([{ target: 100, actual: null, confirmed: false }], deliveries);
    assert.equal(p.light, null);
    assert.equal(p.target, 100);
  });

  it('a percentage KPI averages: 97%, 94%, 95% against 96% → 99.3%, yellow', () => {
    const months = [97, 94, 95].map((actual) => ({ target: 96, actual, confirmed: true }));
    const p = periodProgress(months, { aggregation: 'AVERAGE', direction: 'HIGHER_IS_BETTER' });
    assert.equal(p.actual, 95.33);
    assert.equal(p.achievement, 99.3);
    assert.equal(p.light, 'YELLOW');
  });
});
