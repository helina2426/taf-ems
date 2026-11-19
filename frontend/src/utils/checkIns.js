// Helpers for weekly check-ins (version 2, Module 14). Plain functions, unit-tested.
// A week starts on Monday; it is named by its Monday ("weekStart", like "2026-11-16").

import { formatDate } from './format.js';

export function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftWeek(weekStart, weeks) {
  return addDays(weekStart, weeks * 7);
}

// "Hidar 7 – 13, 2019" style is hard across months, so we show both ends: "Hidar 7, 2019 – Hidar 13, 2019".
export function weekLabel(weekStart) {
  return `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;
}

// A short name for the week, compared with this week.
export function weekName(weekStart, thisWeek) {
  if (weekStart === thisWeek) return 'This week';
  if (weekStart === shiftWeek(thisWeek, -1)) return 'Last week';
  return `Week of ${formatDate(weekStart)}`;
}

// The badge of a row in the Manager's week view.
export function checkInState(checkIn) {
  if (!checkIn) return { label: 'Not written', tone: 'neutral' };
  if (!checkIn.reply) return { label: 'Waiting for a reply', tone: 'info' };
  return { label: 'Replied', tone: 'good' };
}

// Menu items marked with a feature are hidden while that feature is switched off.
export function visibleMenu(items, features) {
  return items.filter((item) => !item.feature || features[item.feature] !== false);
}
