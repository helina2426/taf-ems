// Labels and helpers for monthly progress (version 2, Module 13). Plain functions, unit-tested.

export const LIGHT = {
  GREEN: { label: 'On track', tone: 'good' },
  YELLOW: { label: 'At risk', tone: 'warn' },
  RED: { label: 'Off track', tone: 'bad' },
};

export const ACTUAL_STATE = {
  EMPTY: { label: 'Not entered', tone: 'neutral' },
  ENTERED: { label: 'Waiting for confirmation', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'good' },
};

// The month to show first: the last OPEN month, otherwise the last month that has started.
export function defaultMonthId(periods) {
  const months = periods.filter((p) => p.type === 'MONTH');
  const open = months.filter((m) => m.status === 'OPEN');
  const started = months.filter((m) => m.status !== 'UPCOMING');
  return (open.at(-1) ?? started.at(-1) ?? months[0])?.id ?? '';
}

// The quarter (and half) a month belongs to.
export function parentsOf(periods, monthId) {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const quarter = byId.get(byId.get(monthId)?.parentId);
  const half = quarter ? byId.get(quarter.parentId) : undefined;
  return { quarter, half };
}

// The columns of the summary table: Q1–Q4, H1, H2 and the year, in that order.
export function summaryColumns(periods) {
  const order = { QUARTER: 0, HALF: 1, YEAR: 2 };
  return periods
    .filter((p) => p.type !== 'MONTH')
    .sort((a, b) => order[a.type] - order[b.type] || a.sequence - b.sequence)
    .map((p) => ({ id: p.id, label: p.type === 'YEAR' ? 'Year' : `${p.type === 'QUARTER' ? 'Q' : 'H'}${p.sequence}`, status: p.status }));
}

// How many numbers of one month wait for confirmation.
export function waitingInMonth(kpis, monthId) {
  return kpis.filter((k) => k.months.find((m) => m.periodId === monthId)?.state === 'ENTERED').length;
}
