// Converts dates between the Ethiopian calendar (EC) and the Gregorian calendar (GC).
//
// The SAME file is used by the backend (src/shared) and the frontend (src/utils),
// so both always agree. It has no imports and works with plain "YYYY-MM-DD" text
// for Gregorian dates, so time zones can never shift a day.
//
// How the Ethiopian calendar works:
//   • 13 months: 12 months of 30 days (Meskerem … Nehase) + Pagume, which has 5 days,
//     or 6 days in a leap year.
//   • An Ethiopian year is a leap year when (year % 4 === 3). Example: 2015 had Pagume 6.
//   • The new year (Meskerem 1) is on 11 September, or 12 September in the year
//     before a Gregorian leap year.
//
// How the conversion works: every day gets a number (its "day number", counted from a
// fixed starting day). We turn an Ethiopian date into a day number, then the day number
// into a Gregorian date — and back. (Astronomers call this the Julian Day Number.)

export const EC_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
];

export const GC_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The day number of Meskerem 1, year 1 (EC), minus one.
const EC_EPOCH = 1724220;
// The day number of 1 January 1970 (GC) — where JavaScript's Date starts counting.
const UNIX_EPOCH = 2440588;
const MS_PER_DAY = 86_400_000;

export function isEcLeapYear(year) {
  return year % 4 === 3;
}

export function pagumeDays(year) {
  return isEcLeapYear(year) ? 6 : 5;
}

export function daysInEcMonth(year, month) {
  return month === 13 ? pagumeDays(year) : 30;
}

export function isValidEcDate(year, month, day) {
  return (
    Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
    year >= 1 && month >= 1 && month <= 13 && day >= 1 && day <= daysInEcMonth(year, month)
  );
}

// ---------- Ethiopian ↔ day number ----------

function ecToDayNumber(year, month, day) {
  return EC_EPOCH + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day;
}

function dayNumberToEc(dayNumber) {
  const n = dayNumber - EC_EPOCH - 1; // days since Meskerem 1, year 1 (0 = that day)
  const year = Math.floor((4 * n + 1463) / 1461);
  const dayOfYear = n - (365 * (year - 1) + Math.floor(year / 4)); // 0 … 365
  return { year, month: Math.floor(dayOfYear / 30) + 1, day: (dayOfYear % 30) + 1 };
}

// ---------- Gregorian "YYYY-MM-DD" ↔ day number ----------

function gcToDayNumber(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY) + UNIX_EPOCH;
}

function dayNumberToGc(dayNumber) {
  return new Date((dayNumber - UNIX_EPOCH) * MS_PER_DAY).toISOString().slice(0, 10);
}

// ---------- Public conversions ----------

// toGregorian(2019, 1, 1) → "2026-09-11"
export function toGregorian(year, month, day) {
  if (!isValidEcDate(year, month, day)) {
    throw new RangeError(`${day}/${month}/${year} is not a valid Ethiopian date.`);
  }
  return dayNumberToGc(ecToDayNumber(year, month, day));
}

// toEthiopian("2026-09-11") → { year: 2019, month: 1, day: 1 }
export function toEthiopian(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) {
    throw new RangeError(`"${isoDate}" is not a date in the format YYYY-MM-DD.`);
  }
  return dayNumberToEc(gcToDayNumber(isoDate));
}

// Adds (or subtracts) whole days to a Gregorian "YYYY-MM-DD" date.
export function addDays(isoDate, days) {
  return dayNumberToGc(gcToDayNumber(isoDate) + days);
}

// ---------- Showing dates ----------

// "2026-07-08" → "Hamle 1, 2018"
export function formatEthiopian(isoDate) {
  const { year, month, day } = toEthiopian(isoDate.slice(0, 10));
  return `${EC_MONTHS[month - 1]} ${day}, ${year}`;
}

// "2026-07-08" → "8 Jul 2026"
export function formatGregorian(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${d} ${GC_MONTHS[m - 1].slice(0, 3)} ${y}`;
}

// The calendar is 'ETHIOPIAN' or 'GREGORIAN'.
export function formatInCalendar(isoDate, calendar) {
  return calendar === 'GREGORIAN' ? formatGregorian(isoDate) : formatEthiopian(isoDate);
}
