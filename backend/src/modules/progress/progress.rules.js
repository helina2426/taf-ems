// How monthly numbers become progress: totals, achievement % and the traffic light.
// Pure functions (no database), so they are easy to unit-test (test/unit/progressRules.test.js).
// Module 16 (evaluations) uses the same functions, so progress and scores always agree.

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

// Months → one number, the way the KPI says.
//   SUM:     add them up          (100 + 104 + 96 = 300 deliveries)
//   AVERAGE: their average        (92% + 95% + 98% → 95%)
//   LAST:    the last month       (a stock level at the end)
export function aggregate(values, aggregation) {
  if (values.length === 0) return null;
  if (aggregation === 'AVERAGE') return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
  if (aggregation === 'LAST') return values[values.length - 1];
  return round2(values.reduce((sum, v) => sum + v, 0));
}

// How much of the target was reached, in %, by direction. Never more than `cap` (120 by default).
//   HIGHER_IS_BETTER: actual ÷ target            (315 of 300 → 105%)
//   LOWER_IS_BETTER:  target ÷ actual            (fuel loss: target 200, actual 250 → 80%)
//   EXACT:            100% minus how far off     (target 500, actual 450 → 90%)
//   ZERO:             0 → 100%, 1 → 50%, 2 or more → 0%
export function achievement(target, actual, direction, cap = 120) {
  if (actual === null || actual === undefined) return null;
  let percent;
  if (direction === 'ZERO') {
    percent = actual <= 0 ? 100 : actual <= 1 ? 50 : 0;
  } else if (direction === 'LOWER_IS_BETTER') {
    if (actual <= 0) percent = cap; // nothing lost: the best possible
    else percent = target <= 0 ? 0 : (target / actual) * 100;
  } else if (direction === 'EXACT') {
    if (target === 0) percent = actual === 0 ? 100 : 0;
    else percent = Math.max(0, 100 - (Math.abs(actual - target) / target) * 100);
  } else if (target <= 0) {
    percent = actual > 0 ? cap : 100;
  } else {
    percent = (actual / target) * 100;
  }
  return round1(Math.min(Math.max(percent, 0), cap));
}

// The traffic light for an achievement %:
//   100% or more → GREEN  (on track)
//   85–99%       → YELLOW (at risk)        — the same 85% line as the score table (85–99% = score 3)
//   below 85%    → RED    (off track)
export function trafficLight(percent) {
  if (percent === null || percent === undefined) return null;
  if (percent >= 100) return 'GREEN';
  if (percent >= 85) return 'YELLOW';
  return 'RED';
}

// Progress of one KPI over some months (a quarter, a half, the year).
// `months` = [{ target, actual, confirmed }] in order. Only CONFIRMED actual numbers count,
// and the target is compared over the SAME months ("so far"), so a quarter that is half
// finished is judged on the months that are already known.
export function periodProgress(months, kpi, cap = 120) {
  const known = months.filter((m) => m.confirmed && m.actual !== null && m.actual !== undefined);
  const target = aggregate(months.map((m) => m.target), kpi.aggregation);
  if (known.length === 0) {
    return { target, targetSoFar: null, actual: null, achievement: null, light: null, monthsKnown: 0, monthsTotal: months.length };
  }
  const targetSoFar = aggregate(known.map((m) => m.target), kpi.aggregation);
  const actual = aggregate(known.map((m) => m.actual), kpi.aggregation);
  const percent = achievement(targetSoFar, actual, kpi.direction, cap);
  return { target, targetSoFar, actual, achievement: percent, light: trafficLight(percent), monthsKnown: known.length, monthsTotal: months.length };
}
