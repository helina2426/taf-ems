// Unit tests for the weekly check-in helpers (src/utils/checkIns.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, checkInState, shiftWeek, visibleMenu, weekName } from '../src/utils/checkIns.js';

describe('check-in helpers', () => {
  it('moves from week to week, also across years', () => {
    assert.equal(shiftWeek('2026-11-16', -1), '2026-11-09');
    assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04');
    assert.equal(addDays('2026-11-16', 6), '2026-11-22');
  });

  it('names this week and last week', () => {
    assert.equal(weekName('2026-11-16', '2026-11-16'), 'This week');
    assert.equal(weekName('2026-11-09', '2026-11-16'), 'Last week');
    assert.match(weekName('2026-11-02', '2026-11-16'), /^Week of /);
  });

  it('shows not written / waiting / replied', () => {
    assert.equal(checkInState(null).label, 'Not written');
    assert.equal(checkInState({ reply: null }).tone, 'info');
    assert.equal(checkInState({ reply: 'Thanks' }).label, 'Replied');
  });

  it('hides the check-ins menu item while check-ins are switched off', () => {
    const items = [{ to: '/dashboard' }, { to: '/check-ins', feature: 'checkIns' }];
    assert.equal(visibleMenu(items, { checkIns: true }).length, 2);
    assert.equal(visibleMenu(items, { checkIns: false }).length, 1);
    // Still loading (unknown): show it, the page itself explains if it is off.
    assert.equal(visibleMenu(items, {}).length, 2);
  });
});
