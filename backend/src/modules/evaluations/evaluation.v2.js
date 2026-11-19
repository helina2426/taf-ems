// Version 2 (Module 16): plan-based evaluations — the parts that are different from version 1.
//
//   Which evaluation?    A plan-year period of type HALF (the first half) = MID-YEAR review,
//                        type YEAR = ANNUAL evaluation. Version 1 periods (no plan year) work as before.
//   Which plan?          An employee → their own plan. A Manager → their company's plan.
//   KPI scores           Calculated by the system from the CONFIRMED monthly numbers of the months
//                        of the period (the same calculation as the traffic lights). Nobody types them.
//                        While the evaluation can still change, they are calculated again every time
//                        (a number confirmed tomorrow counts). When it is submitted they are saved
//                        ("frozen") in EvaluationScore with the numbers they came from.
//   Behaviour scores     Given by the evaluator, 1–5, like in version 1, but counted in points.
//   Totals and rating    evaluation.scoring.js.

import prisma from '../../config/prisma.js';
import { toDateOnly } from '../../shared/validation.js';
import { periodProgress } from '../progress/progress.rules.js';
import { behaviourWeightPoints, evaluationTotals, kpiScore, pointsFor } from './evaluation.scoring.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));

export const EDITABLE = ['DRAFT', 'RETURNED'];

// MID_YEAR, ANNUAL, or null for a version 1 period.
export function evaluationKind(period) {
  if (!period?.cycleId) return null;
  if (period.type === 'YEAR') return 'ANNUAL';
  if (period.type === 'HALF' && period.sequence === 1) return 'MID_YEAR';
  return null;
}

export const KIND_LABEL = { MID_YEAR: 'mid-year review', ANNUAL: 'annual evaluation' };

// The plan the person is evaluated on: their own plan, or (for a Manager) the company plan.
export function findPlan({ cycleId, type, employeeId, companyId }, db = prisma) {
  const scope = type === 'MANAGER' ? `COMPANY:${companyId}` : `EMPLOYEE:${employeeId}`;
  return db.plan.findFirst({
    where: { cycleId, scope },
    include: {
      kpis: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { months: { select: { periodId: true, target: true, actual: true, confirmedAt: true } } },
      },
    },
  });
}

// The months of a period (H1 = 6 months, the year = 12), in order.
export function findMonths(period, db = prisma) {
  return db.evaluationPeriod.findMany({
    where: { cycleId: period.cycleId, type: 'MONTH', startDate: { gte: period.startDate }, endDate: { lte: period.endDate } },
    orderBy: { startDate: 'asc' },
  });
}

// The KPI scores, calculated now from the confirmed monthly numbers.
export function calculateKpiScores(plan, months, cap) {
  return plan.kpis.map((kpi) => {
    const byPeriod = new Map(kpi.months.map((m) => [m.periodId, m]));
    const rows = months.map((month) => {
      const m = byPeriod.get(month.id);
      return { target: num(m?.target) ?? 0, actual: num(m?.actual), confirmed: Boolean(m?.confirmedAt) };
    });
    const p = periodProgress(rows, kpi, cap);
    const score = kpiScore(p.achievement);
    return {
      kpiId: kpi.id,
      name: kpi.name,
      unit: kpi.unit,
      direction: kpi.direction,
      weight: kpi.weight,
      periodTarget: p.target, // the target of the whole period (H1 or the year)
      targetUsed: p.targetSoFar, // the target of the months that have a confirmed number
      actualUsed: p.actual,
      achievementPercent: p.achievement,
      score,
      points: score === null ? null : pointsFor(score, kpi.weight),
      monthsUsed: p.monthsKnown,
      monthsTotal: p.monthsTotal,
    };
  });
}

// The KPI scores saved at submission (an evaluation that can no longer change).
function storedKpiScores(evaluation) {
  return evaluation.scores
    .filter((s) => s.kpiId)
    .map((s) => ({
      kpiId: s.kpiId,
      name: s.kpi?.name ?? 'KPI',
      unit: s.kpi?.unit ?? '',
      direction: s.kpi?.direction ?? null,
      weight: Number(s.weightUsed),
      periodTarget: null,
      targetUsed: num(s.targetUsed),
      actualUsed: num(s.actualUsed),
      achievementPercent: num(s.achievementPercent),
      score: s.score,
      points: pointsFor(s.score, Number(s.weightUsed)),
      monthsUsed: s.monthsUsed,
      monthsTotal: null,
      comment: s.comment,
    }));
}

// Everything the version 2 part of an evaluation needs: the KPI scores, the behaviours and the totals.
//   live = true  → KPI scores calculated now (DRAFT / RETURNED)
//   live = false → the saved ones (SUBMITTED and later)
export async function buildV2(evaluation, { live = EDITABLE.includes(evaluation.status) } = {}, db = prisma) {
  const cycle = await db.performanceCycle.findUnique({ where: { id: evaluation.period.cycleId } });
  const behaviourPart = 100 - (evaluation.resultsShare ?? cycle.employeeResultsShare);
  const criteria = await db.evaluationCriterion.findMany({ where: { appliesTo: evaluation.type, isActive: true } });
  const scoreByCriterion = new Map(evaluation.scores.filter((s) => s.criterionId).map((s) => [s.criterionId, s]));

  // The behaviours: the active list while the evaluation can change; afterwards, what was scored.
  const behaviours = live
    ? criteria.map((c) => ({
        criterionId: c.id,
        name: c.name,
        isSafety: c.isSafety,
        weightPercent: Number(c.weight),
        weightPoints: behaviourWeightPoints(c.weight, behaviourPart),
        score: scoreByCriterion.get(c.id)?.score ?? null,
        comment: scoreByCriterion.get(c.id)?.comment ?? null,
      }))
    : evaluation.scores
        .filter((s) => s.criterionId)
        .map((s) => ({
          criterionId: s.criterionId,
          name: s.criterion?.name ?? 'Behaviour',
          isSafety: Boolean(s.criterion?.isSafety),
          weightPercent: null,
          weightPoints: Number(s.weightUsed),
          score: s.score,
          comment: s.comment,
        }));
  for (const b of behaviours) b.points = b.score === null ? null : pointsFor(b.score, b.weightPoints);

  let kpiScores = [];
  let planMissing = false;
  if (live) {
    const plan = await findPlan({ cycleId: cycle.id, type: evaluation.type, employeeId: evaluation.employeeId, companyId: evaluation.companyId }, db);
    planMissing = !plan || plan.status !== 'ACTIVE';
    if (!planMissing) kpiScores = calculateKpiScores(plan, await findMonths(evaluation.period, db), cycle.achievementCap);
  } else {
    kpiScores = storedKpiScores(evaluation);
  }

  const totals = live
    ? evaluationTotals({ kpis: kpiScores, behaviours, safetyCapEnabled: cycle.safetyCapEnabled })
    : {
        resultsScore: num(evaluation.resultsScore),
        behaviourScore: num(evaluation.behaviourScore),
        overallScore: num(evaluation.overallScore),
        rating: evaluation.rating,
        safetyCapApplied: evaluation.safetyCapApplied,
      };

  return {
    kind: evaluationKind(evaluation.period),
    planYear: { id: cycle.id, name: cycle.name, safetyCapEnabled: cycle.safetyCapEnabled, achievementCap: cycle.achievementCap },
    resultsShare: evaluation.resultsShare,
    behaviourPart,
    planMissing,
    kpiScores,
    behaviours,
    totals,
  };
}

// For the response of the period list.
export function toPeriodOption(period) {
  const kind = period.cycleId ? evaluationKind(period) : 'VERSION_1';
  const name = period.cycleId ? `${period.cycle.name} — ${kind === 'ANNUAL' ? 'annual evaluation' : 'mid-year review (first half)'}` : period.name;
  return {
    id: period.id,
    name,
    kind,
    status: period.status,
    startDate: toDateOnly(period.startDate),
    endDate: toDateOnly(period.endDate),
    planYear: period.cycle ? { id: period.cycle.id, name: period.cycle.name, status: period.cycle.status } : null,
  };
}
