// Helpers for target changes during the year (version 2, Module 17). Plain functions, unit-tested.
// The preview uses the same rule as the backend (changeRequest.rules.js); the backend decides.

export const CHANGE_STATUS = {
  PENDING: { label: 'Waiting for the Head', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'good' },
  REJECTED: { label: 'Rejected', tone: 'bad' },
};

const round2 = (value) => Math.round(value * 100) / 100;

function share(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const values = Array(count).fill(base / 100);
  values[count - 1] = (cents - base * (count - 1)) / 100;
  return values;
}

// What the 12 months would look like with a new year target. Months that are over keep their target.
//   kpi = { aggregation, direction, months: [{ target, endDate }] }. Returns { targets, changed } or { error }.
export function previewChange(kpi, newYearTarget, today = new Date().toISOString().slice(0, 10)) {
  if (kpi.direction === 'ZERO') return { error: 'A "zero is best" KPI always has a target of 0.' };
  if (!Number.isFinite(newYearTarget) || newYearTarget < 0) return { error: 'Enter a target of 0 or more.' };
  const locked = kpi.months.map((m) => m.endDate < today);
  const open = locked.map((l, i) => (l ? -1 : i)).filter((i) => i >= 0);
  if (open.length === 0) return { error: 'Every month of the year is over.' };
  const targets = kpi.months.map((m) => m.target);
  const lockedTotal = round2(kpi.months.filter((_, i) => locked[i]).reduce((sum, m) => sum + m.target, 0));
  if (kpi.aggregation === 'LAST') {
    for (const i of open) targets[i] = round2(newYearTarget);
  } else {
    const rest = kpi.aggregation === 'AVERAGE' ? round2(newYearTarget * 12 - lockedTotal) : round2(newYearTarget - lockedTotal);
    if (rest < 0) return { error: `The months that are over already have ${lockedTotal}; the new target cannot be lower.` };
    share(rest, open.length).forEach((value, j) => {
      targets[open[j]] = value;
    });
  }
  return { targets, changed: open.length, firstChanged: open[0] };
}
