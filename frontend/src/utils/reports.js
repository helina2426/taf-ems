// Helpers for the version 2 reports and dashboards (Module 19). Plain functions, unit-tested.

import { RATING_LABEL, RATING_TONE } from './evaluations.js';

export const RATING_ORDER = ['EXCEEDS', 'SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET'];

// { GREEN: 4, YELLOW: 0, RED: 1, NONE: 0 } → "4 on track · 1 off track"
export function lightsText(lights) {
  if (!lights) return 'No plan';
  const parts = [];
  if (lights.GREEN) parts.push(`${lights.GREEN} on track`);
  if (lights.YELLOW) parts.push(`${lights.YELLOW} at risk`);
  if (lights.RED) parts.push(`${lights.RED} off track`);
  if (lights.NONE) parts.push(`${lights.NONE} no numbers yet`);
  return parts.length ? parts.join(' · ') : 'No KPIs';
}

// The rating distribution as bars, best rating first.
export function ratingBars(distribution) {
  return RATING_ORDER.map((key) => ({
    key,
    label: RATING_LABEL[key],
    tone: RATING_TONE[key],
    count: distribution?.[key] ?? 0,
    percent: distribution?.percent?.[key] ?? 0,
  }));
}

// "75 / 100 · Successfully meets" (a version 1 result has no rating: "75%").
export function resultText(evaluation) {
  if (!evaluation || evaluation.overallScore === null || evaluation.overallScore === undefined) return null;
  const score = Math.round(evaluation.overallScore * 10) / 10;
  return evaluation.rating ? `${score} / 100 · ${RATING_LABEL[evaluation.rating]}` : `${score}%`;
}

// "2019 EFY · Q1" → "Q1"
export function quarterLabel(name) {
  return name.split('·').pop().trim();
}
