// Small pieces shared by the plan-year report and the dashboards (version 2, Module 19).

import { Link } from 'react-router';
import { fullName } from '../../utils/format.js';
import { LIGHT } from '../../utils/progress.js';
import { lightsText, ratingBars } from '../../utils/reports.js';

// A coloured dot, with its meaning for screen readers. No light yet → a grey dash.
export function LightDot({ light }) {
  if (!light) return <span className="muted" title="No confirmed numbers yet">–</span>;
  return <span className={`light light-${light.toLowerCase()}`} role="img" aria-label={LIGHT[light].label} title={LIGHT[light].label} />;
}

// "● 4  ● 0  ● 1" with the words next to it.
export function LightCounts({ lights }) {
  if (!lights) return <span className="muted">No active plan</span>;
  return (
    <span className="light-counts" title={lightsText(lights)}>
      {['GREEN', 'YELLOW', 'RED'].map((key) => (
        <span key={key} className="light-count">
          <LightDot light={key} /> {lights[key]}
        </span>
      ))}
      {lights.NONE > 0 && <span className="muted small">+{lights.NONE} no numbers</span>}
    </span>
  );
}

// The rating distribution: one bar per rating, with the count and the percentage.
export function RatingBars({ distribution }) {
  if (!distribution || distribution.total === 0) return <p className="muted">No published plan-based evaluations yet.</p>;
  return (
    <div className="rating-bars">
      {ratingBars(distribution).map((bar) => (
        <div key={bar.key} className="rating-bar-row">
          <span className="rating-bar-label">{bar.label}</span>
          <span className="rating-bar-track" aria-hidden="true">
            <span className={`rating-bar-fill tone-${bar.tone}`} style={{ width: `${bar.percent}%` }} />
          </span>
          <span className="rating-bar-value">
            {bar.count} <span className="muted small">({bar.percent}%)</span>
          </span>
        </div>
      ))}
      <div className="muted small">{distribution.total} published evaluation(s)</div>
    </div>
  );
}

// A list of people with their KPI lights (on track / at risk / off track …).
export function PeopleList({ people, empty, showCompany }) {
  if (people.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <ul className="people-list">
      {people.map((p) => (
        <li key={p.employee.id}>
          <span>
            {p.planId || p.plan?.id ? <Link to={`/plans/${p.planId ?? p.plan.id}`}>{fullName(p.employee)}</Link> : fullName(p.employee)}
            {showCompany && p.company && <span className="muted small"> · {p.company.name}</span>}
          </span>
          {(p.lights || p.plan?.lights) && <LightCounts lights={p.lights ?? p.plan.lights} />}
        </li>
      ))}
    </ul>
  );
}
