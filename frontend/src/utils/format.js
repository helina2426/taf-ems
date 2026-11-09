// Small helpers to show values nicely. Kept apart from the components so that
// Vite's hot reload works best (a file should export either components or plain functions).

// Finds the message for one field in an ApiError's details.
export function fieldError(error, field) {
  return error?.details?.find((d) => d.field === field)?.message;
}

// "2026-11-08" or "2026-11-08T17:21:22.806Z" → "8 Nov 2026"
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// → "8 Nov 2026, 20:21"
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
