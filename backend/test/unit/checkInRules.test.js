// Unit tests for the week rules of weekly check-ins (Module 14).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, isMonday, isWritableWeek, mondayOf, weekEndOf, writableWeeks } from '../../src/modules/check-ins/checkIn.rules.js';

describe('weeks of check-ins', () => {
  test('a week starts on Monday', () => {
    assert.equal(isMonday('2026-11-16'), true); // Monday
    assert.equal(isMonday('2026-11-19'), false); // Thursday
    assert.equal(isMonday('2026-11-22'), false); // Sunday
  });

  test('mondayOf finds the Monday of any day of the week', () => {
    assert.equal(mondayOf('2026-11-16'), '2026-11-16');
    assert.equal(mondayOf('2026-11-19'), '2026-11-16');
    assert.equal(mondayOf('2026-11-22'), '2026-11-16'); // Sunday still belongs to that week
    assert.equal(mondayOf('2026-11-23'), '2026-11-23');
  });

  test('works across months and years', () => {
    assert.equal(mondayOf('2027-01-01'), '2026-12-28');
    assert.equal(addDays('2026-12-28', 7), '2027-01-04');
    assert.equal(weekEndOf('2026-12-28'), '2027-01-03');
  });

  test('an employee may write this week and last week only', () => {
    assert.deepEqual(writableWeeks('2026-11-19'), ['2026-11-16', '2026-11-09']);
    assert.equal(isWritableWeek('2026-11-16', '2026-11-19'), true);
    assert.equal(isWritableWeek('2026-11-09', '2026-11-19'), true);
    assert.equal(isWritableWeek('2026-11-02', '2026-11-19'), false); // too old
    assert.equal(isWritableWeek('2026-11-23', '2026-11-19'), false); // the future
  });
});
