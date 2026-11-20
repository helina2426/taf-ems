// Unit tests for the version 2 report helpers (src/utils/reports.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lightsText, quarterLabel, ratingBars, resultText } from '../src/utils/reports.js';

describe('reports v2 helpers', () => {
  it('describes the lights in words', () => {
    assert.equal(lightsText({ GREEN: 4, YELLOW: 0, RED: 1, NONE: 0 }), '4 on track · 1 off track');
    assert.equal(lightsText({ GREEN: 0, YELLOW: 2, RED: 0, NONE: 1 }), '2 at risk · 1 no numbers yet');
    assert.equal(lightsText({ GREEN: 0, YELLOW: 0, RED: 0, NONE: 0 }), 'No KPIs');
    assert.equal(lightsText(null), 'No plan');
  });

  it('turns a distribution into bars, best first', () => {
    const bars = ratingBars({ EXCEEDS: 0, SUCCESSFULLY_MEETS: 2, PARTIALLY_MEETS: 1, DOES_NOT_MEET: 0, total: 3, percent: { SUCCESSFULLY_MEETS: 66.7, PARTIALLY_MEETS: 33.3 } });
    assert.deepEqual(bars.map((b) => b.key), ['EXCEEDS', 'SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET']);
    assert.equal(bars[1].count, 2);
    assert.equal(bars[1].percent, 66.7);
    assert.equal(bars[0].percent, 0);
    assert.equal(ratingBars(null)[3].count, 0);
  });

  it('writes a result with its rating', () => {
    assert.equal(resultText({ overallScore: 75, rating: 'SUCCESSFULLY_MEETS' }), '75 / 100 · Successfully meets');
    assert.equal(resultText({ overallScore: 67.14, rating: 'PARTIALLY_MEETS' }), '67.1 / 100 · Partially meets');
    assert.equal(resultText({ overallScore: 82, rating: null }), '82%');
    assert.equal(resultText(null), null);
  });

  it('shortens quarter names', () => {
    assert.equal(quarterLabel('2019 EFY · Q3'), 'Q3');
  });
});
