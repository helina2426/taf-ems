// Unit tests for the small display helpers in src/utils.
// Run with:  npm test   (uses Node's built-in test runner — nothing to install)

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fieldError, formatDate, fullName, humanize, percent, setDisplayCalendar, withoutEmpty } from '../src/utils/format.js';

describe('format helpers', () => {
  it('humanize turns ON_LEAVE into "On leave"', () => assert.equal(humanize('ON_LEAVE'), 'On leave'));
  it('percent shows a dash when there is no value', () => {
    assert.equal(percent(null), '—');
    assert.equal(percent(85), '85%');
  });
  it('fullName joins first and last name', () => assert.equal(fullName({ firstName: 'Dawit', lastName: 'Bekele' }), 'Dawit Bekele'));
  it('withoutEmpty removes empty fields before sending a form', () => {
    assert.deepEqual(withoutEmpty({ name: 'Taf', phone: '', email: undefined }), { name: 'Taf' });
  });
  it('fieldError finds the message for one field', () => {
    const error = { details: [{ field: 'code', message: 'Code is required.' }] };
    assert.equal(fieldError(error, 'code'), 'Code is required.');
    assert.equal(fieldError(error, 'name'), undefined);
  });
});

describe('dates in the chosen calendar (version 2)', () => {
  it('shows Ethiopian dates by default', () => {
    setDisplayCalendar('ETHIOPIAN');
    assert.equal(formatDate('2026-07-08'), 'Hamle 1, 2018');
  });
  it('shows Gregorian dates when the person chose Gregorian', () => {
    setDisplayCalendar('GREGORIAN');
    assert.equal(formatDate('2026-07-08'), '8 Jul 2026');
    setDisplayCalendar('ETHIOPIAN');
  });
  it('can show a date in a given calendar, and a dash when there is no date', () => {
    assert.equal(formatDate('2026-09-11', 'ETHIOPIAN'), 'Meskerem 1, 2019');
    assert.equal(formatDate(null), '—');
  });
});

