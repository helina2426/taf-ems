// Unit tests for the plan-based evaluation formulas (Module 16, evaluation.scoring.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySafetyCap,
  behaviourWeightPoints,
  evaluationTotals,
  kpiScore,
  monthsInYear,
  pointsFor,
  ratingFor,
} from '../../src/modules/evaluations/evaluation.scoring.js';

describe('KPI score from achievement %', () => {
  test('the 5 bands: 110+ → 5, 100–109 → 4, 85–99 → 3, 70–84 → 2, below 70 → 1', () => {
    assert.equal(kpiScore(120), 5);
    assert.equal(kpiScore(110), 5);
    assert.equal(kpiScore(109.9), 4);
    assert.equal(kpiScore(100), 4);
    assert.equal(kpiScore(99.9), 3);
    assert.equal(kpiScore(85), 3);
    assert.equal(kpiScore(84.9), 2);
    assert.equal(kpiScore(70), 2);
    assert.equal(kpiScore(69.9), 1);
    assert.equal(kpiScore(0), 1);
  });
  test('no confirmed number → no score', () => {
    assert.equal(kpiScore(null), null);
  });
});

describe('points', () => {
  test('score ÷ 5 × weight', () => {
    assert.equal(pointsFor(4, 30), 24);
    assert.equal(pointsFor(1, 20), 4);
    assert.equal(pointsFor(5, 10), 10);
  });
  test('a behaviour weight in % becomes points of the behaviour part', () => {
    assert.equal(behaviourWeightPoints(20, 30), 6); // Safety: 20% of 30 points
    assert.equal(behaviourWeightPoints(15, 30), 4.5);
    assert.equal(behaviourWeightPoints(15, 20), 3); // a Manager: 15% of 20 points
  });
});

describe('rating', () => {
  test('90 / 75 / 55 bands', () => {
    assert.equal(ratingFor(95), 'EXCEEDS');
    assert.equal(ratingFor(90), 'EXCEEDS');
    assert.equal(ratingFor(89.99), 'SUCCESSFULLY_MEETS');
    assert.equal(ratingFor(75), 'SUCCESSFULLY_MEETS');
    assert.equal(ratingFor(74.99), 'PARTIALLY_MEETS');
    assert.equal(ratingFor(55), 'PARTIALLY_MEETS');
    assert.equal(ratingFor(54.99), 'DOES_NOT_MEET');
    assert.equal(ratingFor(null), null);
  });
  test('the safety rule lowers a good rating when Safety = 1 (only if switched on)', () => {
    assert.deepEqual(applySafetyCap('EXCEEDS', 1, true), { rating: 'PARTIALLY_MEETS', safetyCapApplied: true });
    assert.deepEqual(applySafetyCap('SUCCESSFULLY_MEETS', 1, true), { rating: 'PARTIALLY_MEETS', safetyCapApplied: true });
    assert.deepEqual(applySafetyCap('EXCEEDS', 1, false), { rating: 'EXCEEDS', safetyCapApplied: false });
    assert.deepEqual(applySafetyCap('EXCEEDS', 2, true), { rating: 'EXCEEDS', safetyCapApplied: false });
    assert.deepEqual(applySafetyCap('DOES_NOT_MEET', 1, true), { rating: 'DOES_NOT_MEET', safetyCapApplied: false });
  });
});

describe('evaluation totals', () => {
  // Dawit's mid-year example: deliveries 4/5 of 30, on-time 4/5 of 20, safety incidents 1/5 of 20 → 44 points.
  const kpis = [
    { weight: 30, score: 4 },
    { weight: 20, score: 4 },
    { weight: 20, score: 1 },
  ];
  const behaviours = [
    { weightPoints: 6, score: 4, isSafety: true },
    { weightPoints: 6, score: 4 },
    { weightPoints: 4.5, score: 3 },
    { weightPoints: 4.5, score: 4 },
    { weightPoints: 4.5, score: 5 },
    { weightPoints: 4.5, score: 3 },
  ];
  test('results + behaviours = overall, then the rating', () => {
    assert.deepEqual(evaluationTotals({ kpis, behaviours }), {
      resultsScore: 44,
      behaviourScore: 23.1,
      overallScore: 67.1,
      rating: 'PARTIALLY_MEETS',
      safetyCapApplied: false,
    });
  });
  test('all 5s give 100 points', () => {
    const full = evaluationTotals({ kpis: kpis.map((k) => ({ ...k, score: 5 })), behaviours: behaviours.map((b) => ({ ...b, score: 5 })) });
    assert.equal(full.overallScore, 100);
    assert.equal(full.rating, 'EXCEEDS');
  });
  test('nothing is known until every KPI and behaviour has a score', () => {
    const t = evaluationTotals({ kpis: [...kpis, { weight: 0, score: null }], behaviours });
    assert.equal(t.resultsScore, null);
    assert.equal(t.overallScore, null);
    assert.equal(t.rating, null);
    assert.equal(t.behaviourScore, 23.1);
  });
  test('the safety rule uses the Safety behaviour', () => {
    const great = evaluationTotals({
      kpis: kpis.map((k) => ({ ...k, score: 5 })),
      behaviours: behaviours.map((b) => ({ ...b, score: b.isSafety ? 1 : 5 })),
      safetyCapEnabled: true,
    });
    assert.equal(great.overallScore, 95.2);
    assert.equal(great.rating, 'PARTIALLY_MEETS');
    assert.equal(great.safetyCapApplied, true);
  });
});

describe('the 6-month rule', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({ startDate: new Date(Date.UTC(2026, 6 + i, 8)) }));
  test('hired before the year: every month counts', () => {
    assert.equal(monthsInYear(months, new Date('2024-01-15')), 12);
    assert.equal(monthsInYear(months, null), 12);
  });
  test('hired during the year: only the full months after the first day', () => {
    assert.equal(monthsInYear(months, new Date('2027-01-08')), 6); // starts on the 7th month's first day
    assert.equal(monthsInYear(months, new Date('2027-01-09')), 5);
  });
});
