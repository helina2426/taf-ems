// Unit tests for the Ethiopian ↔ Gregorian converter (src/shared/ethiopianCalendar.js).
// The expected dates are well-known days (Ethiopian New Year, Genna, the fiscal year start).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  formatEthiopian,
  formatGregorian,
  isEcLeapYear,
  isValidEcDate,
  pagumeDays,
  toEthiopian,
  toGregorian,
} from '../../src/shared/ethiopianCalendar.js';

describe('Ethiopian → Gregorian', () => {
  it('Meskerem 1, 2019 (New Year) is 11 September 2026', () => assert.equal(toGregorian(2019, 1, 1), '2026-09-11'));
  it('Meskerem 1, 2016 is 12 September 2023 (after a Pagume 6)', () => assert.equal(toGregorian(2016, 1, 1), '2023-09-12'));
  it('Meskerem 1, 2012 is 12 September 2019', () => assert.equal(toGregorian(2012, 1, 1), '2019-09-12'));
  it('Hamle 1, 2018 (start of 2019 EFY) is 8 July 2026', () => assert.equal(toGregorian(2018, 11, 1), '2026-07-08'));
  it('Sene 30, 2019 (end of 2019 EFY) is 7 July 2027', () => assert.equal(toGregorian(2019, 10, 30), '2027-07-07'));
  it('Tahsas 29, 2018 (Genna) is 7 January 2026', () => assert.equal(toGregorian(2018, 4, 29), '2026-01-07'));
  it('Pagume 6, 2015 exists and is 11 September 2023', () => assert.equal(toGregorian(2015, 13, 6), '2023-09-11'));
  it('refuses a date that does not exist (Pagume 6 in a normal year)', () => {
    assert.throws(() => toGregorian(2018, 13, 6), RangeError);
    assert.throws(() => toGregorian(2018, 1, 31), RangeError);
  });
});

describe('Gregorian → Ethiopian', () => {
  it('17 November 2026 is Hidar 8, 2019', () => assert.deepEqual(toEthiopian('2026-11-17'), { year: 2019, month: 3, day: 8 }));
  it('10 September 2026 is Pagume 5, 2018', () => assert.deepEqual(toEthiopian('2026-09-10'), { year: 2018, month: 13, day: 5 }));
  it('29 February 2028 converts', () => assert.deepEqual(toEthiopian('2028-02-29'), { year: 2020, month: 6, day: 21 }));
  it('refuses text that is not YYYY-MM-DD', () => assert.throws(() => toEthiopian('17/11/2026'), RangeError));

  it('every day from 1950 to 2150 converts there and back without change', () => {
    let date = '1950-01-01';
    for (let i = 0; i < 365 * 200; i += 1) {
      const ec = toEthiopian(date);
      assert.ok(isValidEcDate(ec.year, ec.month, ec.day), `${date} gave an invalid date`);
      assert.equal(toGregorian(ec.year, ec.month, ec.day), date);
      date = addDays(date, 1);
    }
  });
});

describe('leap years and formatting', () => {
  it('an Ethiopian year is a leap year when year % 4 === 3', () => {
    assert.equal(isEcLeapYear(2015), true);
    assert.equal(isEcLeapYear(2018), false);
    assert.equal(pagumeDays(2015), 6);
    assert.equal(pagumeDays(2018), 5);
  });
  it('formats a date in each calendar', () => {
    assert.equal(formatEthiopian('2026-07-08'), 'Hamle 1, 2018');
    assert.equal(formatGregorian('2026-07-08'), '8 Jul 2026');
  });
});
