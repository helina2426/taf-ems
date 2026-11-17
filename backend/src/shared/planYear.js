// Builds the 19 periods of one plan year: 1 year, 2 halves, 4 quarters, 12 months.
// Pure functions (no database), so they are easy to unit-test.
//
// Ethiopian plan year "2019 EFY" (EFY = Ethiopian Fiscal Year):
//   Hamle 1, 2018 → Sene 30, 2019   (8 July 2026 → 7 July 2027)
//   An Ethiopian fiscal year is named by the year it ends in.
//   Pagume (5 or 6 days) is joined to Nehase, so there are always 12 months.
//
// Gregorian plan year "2026 (GC)":
//   1 January 2026 → 31 December 2026
//
// All dates are Gregorian "YYYY-MM-DD" text (the database stores Gregorian dates).

import { EC_MONTHS, GC_MONTHS, addDays, pagumeDays, toGregorian } from './ethiopianCalendar.js';

export const MIN_PLAN_YEAR = { ETHIOPIAN: 2000, GREGORIAN: 2000 };
export const MAX_PLAN_YEAR = { ETHIOPIAN: 2100, GREGORIAN: 2100 };

export function planYearName(calendar, year) {
  return calendar === 'GREGORIAN' ? `${year} (GC)` : `${year} EFY`;
}

// The 12 months of an Ethiopian fiscal year, in order, with their Gregorian dates.
function ethiopianMonths(year) {
  const previous = year - 1;
  const months = [
    { ecYear: previous, ecMonth: 11 }, // Hamle
    { ecYear: previous, ecMonth: 12 }, // Nehase (+ Pagume)
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ecMonth) => ({ ecYear: year, ecMonth })), // Meskerem … Sene
  ];
  return months.map(({ ecYear, ecMonth }) => {
    const withPagume = ecMonth === 12;
    return {
      label: `${EC_MONTHS[ecMonth - 1]}${withPagume ? ' + Pagume' : ''} ${ecYear}`,
      startDate: toGregorian(ecYear, ecMonth, 1),
      endDate: withPagume ? toGregorian(ecYear, 13, pagumeDays(ecYear)) : toGregorian(ecYear, ecMonth, 30),
    };
  });
}

function gregorianMonths(year) {
  return GC_MONTHS.map((name, index) => {
    const startDate = `${year}-${String(index + 1).padStart(2, '0')}-01`;
    const nextStart = index === 11 ? `${year + 1}-01-01` : `${year}-${String(index + 2).padStart(2, '0')}-01`;
    return { label: `${name} ${year}`, startDate, endDate: addDays(nextStart, -1) };
  });
}

// Returns { name, calendar, year, startDate, endDate, periods: [...] }.
// Each period: { key, type, sequence, name, startDate, endDate, parentKey }.
// parentKey links a month to its quarter, a quarter to its half, a half to the year.
export function buildPlanYear(calendar, year) {
  if (!['ETHIOPIAN', 'GREGORIAN'].includes(calendar)) throw new RangeError(`Unknown calendar "${calendar}".`);
  if (!Number.isInteger(year) || year < MIN_PLAN_YEAR[calendar] || year > MAX_PLAN_YEAR[calendar]) {
    throw new RangeError(`The year must be between ${MIN_PLAN_YEAR[calendar]} and ${MAX_PLAN_YEAR[calendar]}.`);
  }

  const name = planYearName(calendar, year);
  const months = calendar === 'GREGORIAN' ? gregorianMonths(year) : ethiopianMonths(year);
  const span = (list) => ({ startDate: list[0].startDate, endDate: list[list.length - 1].endDate });

  const periods = [{ key: 'Y', type: 'YEAR', sequence: 1, name, ...span(months), parentKey: null }];

  for (let h = 1; h <= 2; h += 1) {
    periods.push({ key: `H${h}`, type: 'HALF', sequence: h, name: `${name} · H${h}`, ...span(months.slice((h - 1) * 6, h * 6)), parentKey: 'Y' });
  }
  for (let q = 1; q <= 4; q += 1) {
    periods.push({
      key: `Q${q}`, type: 'QUARTER', sequence: q, name: `${name} · Q${q}`,
      ...span(months.slice((q - 1) * 3, q * 3)), parentKey: `H${Math.ceil(q / 2)}`,
    });
  }
  months.forEach((month, index) => {
    const m = index + 1;
    periods.push({
      key: `M${m}`, type: 'MONTH', sequence: m, name: `${name} · ${month.label}`,
      startDate: month.startDate, endDate: month.endDate, parentKey: `Q${Math.ceil(m / 3)}`,
    });
  });

  return { name, calendar, year, startDate: periods[0].startDate, endDate: periods[0].endDate, periods };
}
