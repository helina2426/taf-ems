// How a new year target is split over the months that can still change (version 2, Module 17).
// Pure functions (no database), unit-tested in test/unit/changeRequestRules.test.js.
//
// Months that are over (or closed) keep their target: changing them would rewrite history and
// the progress already shown. Only the current and future months get the new targets:
//
//   SUM     (things you count): the rest of the new year target is shared by the remaining months.
//           1,200 → 1,500 after 4 months of 100: 1,500 − 400 = 1,100 over 8 months = 137.50 each.
//   AVERAGE (rates, %):         the remaining months are set so the 12-month average is the new target.
//           96% → 97% after 4 months of 96%: (97 × 12 − 4 × 96) ÷ 8 = 97.50% each.
//   LAST    (a level):          the remaining months all get the new target (the year = the last month).
//   ZERO    ("zero is best"):   the target is always 0, so it cannot change.

const round2 = (value) => Math.round(value * 100) / 100;

// Is this month locked (its target keeps the old value)? It is CLOSED, or it ended before today.
export function isLocked(month, today) {
  return month.status === 'CLOSED' || month.endDate < today;
}

// Shares `total` over `count` months in cents; the last one takes the rounding rest.
function share(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const values = Array(count).fill(base / 100);
  values[count - 1] = (cents - base * (count - 1)) / 100;
  return values;
}

// months = 12 × { target, locked } in order. Returns { targets } (12 numbers) or { error }.
export function resplitTargets(months, newYearTarget, { aggregation, direction }) {
  if (direction === 'ZERO') return { error: 'A "zero is best" KPI always has a target of 0; it cannot be changed.' };
  const open = months.map((m, i) => (m.locked ? -1 : i)).filter((i) => i >= 0);
  if (open.length === 0) return { error: 'Every month of the year is over or closed, so the target can no longer change.' };

  const lockedTotal = round2(months.filter((m) => m.locked).reduce((sum, m) => sum + m.target, 0));
  const targets = months.map((m) => m.target);

  if (aggregation === 'LAST') {
    for (const i of open) targets[i] = round2(newYearTarget);
    return { targets, changedMonths: open.length };
  }

  const rest = aggregation === 'AVERAGE' ? round2(newYearTarget * 12 - lockedTotal) : round2(newYearTarget - lockedTotal);
  if (rest < 0) {
    return {
      error:
        aggregation === 'AVERAGE'
          ? `The months that are over already have high targets; with the remaining months the average cannot go down to ${newYearTarget}.`
          : `The months that are over already have targets adding up to ${lockedTotal}, so the new year target cannot be lower than that.`,
    };
  }
  share(rest, open.length).forEach((value, j) => {
    targets[open[j]] = value;
  });
  return { targets, changedMonths: open.length };
}
