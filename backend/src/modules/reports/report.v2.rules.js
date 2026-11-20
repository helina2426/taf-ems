// Small calculations for the version 2 reports and dashboards (Module 19). Pure functions, unit-tested.

export const LIGHTS = ['GREEN', 'YELLOW', 'RED'];
export const RATING_ORDER = ['EXCEEDS', 'SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET'];

// How many KPIs of a plan are green / yellow / red / not known yet, and the worst one.
//   The worst light decides the list a person appears in: RED = off track, YELLOW = at risk.
export function summarizeLights(lights) {
  const counts = { GREEN: 0, YELLOW: 0, RED: 0, NONE: 0 };
  for (const light of lights) counts[light ?? 'NONE'] += 1;
  const worst = counts.RED > 0 ? 'RED' : counts.YELLOW > 0 ? 'YELLOW' : counts.GREEN > 0 ? 'GREEN' : null;
  return { ...counts, worst };
}

// Ratings → { EXCEEDS: n, …, total, percent: { EXCEEDS: %, … } }.
export function ratingDistribution(ratings) {
  const counts = Object.fromEntries(RATING_ORDER.map((r) => [r, 0]));
  for (const rating of ratings) if (rating in counts) counts[rating] += 1;
  const total = ratings.filter((r) => r in counts).length;
  const percent = Object.fromEntries(RATING_ORDER.map((r) => [r, total ? Math.round((counts[r] / total) * 1000) / 10 : 0]));
  return { ...counts, total, percent };
}

// The plan year a report is about: the one asked for, else the ACTIVE year that contains today,
// else the latest ACTIVE one, else the latest one.
export function choosePlanYear(cycles, today, planYearId) {
  if (planYearId) return cycles.find((c) => c.id === planYearId) ?? null;
  const day = (d) => d.toISOString().slice(0, 10);
  const active = cycles.filter((c) => c.status === 'ACTIVE');
  return active.find((c) => day(c.startDate) <= today && today <= day(c.endDate)) ?? active[0] ?? cycles[0] ?? null;
}
