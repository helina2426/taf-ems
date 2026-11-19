// Small date rules for weekly check-ins (version 2, Module 14). No database here, so they are easy to test.
//
// A week starts on MONDAY. A check-in belongs to one week and is saved with the Monday's date
// ("weekStart", like 2026-11-16). Dates are plain "YYYY-MM-DD" text, counted in Addis Ababa time.
//
// An employee may write the check-in of THIS week, or of LAST week (if they forgot on Friday).
// Older weeks are closed: a note written months later would not be a real weekly note.

const DAY = 24 * 60 * 60 * 1000;

function toDate(text) {
  return new Date(`${text}T00:00:00Z`);
}

function toText(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(text, days) {
  return toText(new Date(toDate(text).getTime() + days * DAY));
}

// 0 = Monday … 6 = Sunday
function dayOfWeek(text) {
  return (toDate(text).getUTCDay() + 6) % 7;
}

export function isMonday(text) {
  return dayOfWeek(text) === 0;
}

// The Monday of the week that contains this day.
export function mondayOf(text) {
  return addDays(text, -dayOfWeek(text));
}

// The Sunday that ends the week.
export function weekEndOf(weekStart) {
  return addDays(weekStart, 6);
}

// The weeks an employee may write today: [this week, last week].
export function writableWeeks(today) {
  const thisWeek = mondayOf(today);
  return [thisWeek, addDays(thisWeek, -7)];
}

export function isWritableWeek(weekStart, today) {
  return writableWeeks(today).includes(weekStart);
}
