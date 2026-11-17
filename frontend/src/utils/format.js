// Small helpers to show values nicely. Kept apart from the components so that
// Vite's hot reload works best (a file should export either components or plain functions).

import { formatEthiopian, formatGregorian } from './ethiopianCalendar.js';

// Version 2: dates are shown in the calendar the logged-in person chose
// ('ETHIOPIAN' by default, or 'GREGORIAN'). AuthContext sets it after login.
// The data itself is always Gregorian; only the way it is SHOWN changes.
let displayCalendar = 'ETHIOPIAN';

export function setDisplayCalendar(calendar) {
  displayCalendar = calendar === 'GREGORIAN' ? 'GREGORIAN' : 'ETHIOPIAN';
}

export function getDisplayCalendar() {
  return displayCalendar;
}

// "2026-11-08T17:21:22.806Z" → the LOCAL day "2026-11-08" (what the person's clock shows).
function localDay(value) {
  if (value.length === 10) return value;
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Finds the message for one field in an ApiError's details.
export function fieldError(error, field) {
  return error?.details?.find((d) => d.field === field)?.message;
}

// "2026-11-08" or "2026-11-08T17:21:22.806Z" → "Hidar 29, 2019" (Ethiopian) or "8 Nov 2026" (Gregorian)
export function formatDate(value, calendar = displayCalendar) {
  if (!value) return '—';
  const day = localDay(value);
  return calendar === 'GREGORIAN' ? formatGregorian(day) : formatEthiopian(day);
}

// The other calendar, for a hint in brackets: "Hamle 1, 2018 (8 Jul 2026)".
export function formatDateBoth(value) {
  if (!value) return '—';
  const other = displayCalendar === 'GREGORIAN' ? 'ETHIOPIAN' : 'GREGORIAN';
  return `${formatDate(value)} (${formatDate(value, other)})`;
}

// → "Hidar 29, 2019, 20:21" or "8 Nov 2026, 20:21"
export function formatDateTime(value) {
  if (!value) return '—';
  const time = new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(value)}, ${time}`;
}

export function fullName(person) {
  if (!person) return '—';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || '—';
}

export function percent(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

// "ON_LEAVE" → "On leave"
export function humanize(value) {
  if (!value) return '—';
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Removes empty strings from a form before sending it, so optional fields are simply left out.
export function withoutEmpty(values) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined));
}
