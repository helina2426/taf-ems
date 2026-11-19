// The standard behaviour lists of Taf EMS (version 2, Module 15).
//
// A behaviour is HOW a person works (results are measured by the KPIs). Like the UN "competencies",
// each behaviour describes what a score of 1, 2, 3, 4 and 5 looks like, so two evaluators who see
// the same behaviour give the same score.
//
//   Employees: 6 behaviours.   Managers: the same 6 + Leadership + Planning & decision-making.
//   The weights of each list add up to 100 (percent of the behaviour part of the evaluation).
//   "Safety" is marked isSafety: the optional safety rule uses it (a 1 in Safety limits the rating).
//
// The Head can load these lists with "Use the standard behaviours", then change them like any criterion.

export const LEVEL_NAMES = ['Not yet', 'Developing', 'Meets expectations', 'Strong', 'Role model'];

const SAFETY = {
  name: 'Safety',
  description: 'Works safely and protects colleagues, customers and the environment.',
  isSafety: true,
  levelDescriptions: [
    'Ignores safety rules or puts themselves or others at risk.',
    'Follows safety rules only when reminded; sometimes skips checks.',
    'Follows every safety rule and reports hazards and incidents.',
    'Spots risks early and helps colleagues work safely.',
    'Leads by example on safety and improves safety practice for the team.',
  ],
};

const INTEGRITY = {
  name: 'Integrity',
  description: 'Is honest and fair, and reports numbers and mistakes truthfully.',
  levelDescriptions: [
    'Is not honest about work, numbers or mistakes.',
    'Is honest most of the time, but hides small problems.',
    'Is honest and fair, reports numbers truthfully and admits mistakes.',
    'Speaks up when something is wrong, even when it is hard.',
    "Is trusted by everyone and protects the company's name and resources.",
  ],
};

const TEAMWORK = {
  name: 'Teamwork',
  description: 'Shares information, helps colleagues and respects everyone.',
  levelDescriptions: [
    'Works alone, does not share information, or causes conflict.',
    'Helps others only when asked.',
    'Shares information, helps colleagues and respects everyone.',
    'Brings people together and helps solve team problems.',
    'Builds a strong team spirit across departments and companies.',
  ],
};

const CUSTOMER_FOCUS = {
  name: 'Customer focus',
  description: 'Understands what customers need and answers them on time.',
  levelDescriptions: [
    'Ignores customer needs or complaints.',
    'Answers customers late or only partly.',
    'Understands customer needs and answers on time.',
    'Thinks ahead about customer needs and follows up without being asked.',
    'Is praised by customers and improves how the company serves them.',
  ],
};

const ACCOUNTABILITY = {
  name: 'Accountability',
  description: 'Delivers what was promised, on time, and owns mistakes.',
  levelDescriptions: [
    'Misses deadlines and blames others.',
    'Finishes tasks, but often late or only after reminders.',
    'Delivers what was promised, on time, and owns mistakes.',
    'Takes ownership of problems and fixes them.',
    'Takes responsibility beyond their own job; an example for others.',
  ],
};

const INITIATIVE = {
  name: 'Initiative',
  description: 'Acts without waiting and looks for better ways of working.',
  levelDescriptions: [
    'Waits to be told what to do.',
    'Takes small steps alone, but needs a push.',
    'Acts on their own tasks without waiting and suggests improvements.',
    'Starts useful changes and finds better ways of working.',
    'Drives new ideas that clearly improve results.',
  ],
};

const LEADERSHIP = {
  name: 'Leadership',
  description: 'Gives the team clear direction, feedback and support.',
  levelDescriptions: [
    'Gives unclear direction; the team does not know the priorities.',
    'Gives direction, but rarely coaches or gives feedback.',
    'Sets clear goals, gives regular feedback and supports the team.',
    'Develops people; the team is motivated and grows.',
    'Inspires the team and builds future leaders.',
  ],
};

const PLANNING = {
  name: 'Planning & decision-making',
  description: 'Plans the work around the KPIs and makes sound, timely decisions.',
  levelDescriptions: [
    'Does not plan; decisions are late or not thought through.',
    'Plans only for the short term; decisions often need correcting.',
    'Plans the work around the KPIs and makes sound, timely decisions.',
    'Plans ahead for risks and uses numbers to decide.',
    'Plans for the long term; decisions clearly improve company results.',
  ],
};

export const STANDARD_BEHAVIOURS = {
  EMPLOYEE: [
    { ...SAFETY, weight: 20 },
    { ...INTEGRITY, weight: 20 },
    { ...TEAMWORK, weight: 15 },
    { ...CUSTOMER_FOCUS, weight: 15 },
    { ...ACCOUNTABILITY, weight: 15 },
    { ...INITIATIVE, weight: 15 },
  ],
  MANAGER: [
    { ...SAFETY, weight: 15 },
    { ...INTEGRITY, weight: 15 },
    { ...LEADERSHIP, weight: 15 },
    { ...PLANNING, weight: 15 },
    { ...TEAMWORK, weight: 10 },
    { ...CUSTOMER_FOCUS, weight: 10 },
    { ...ACCOUNTABILITY, weight: 10 },
    { ...INITIATIVE, weight: 10 },
  ],
};

// The rows to create, one per behaviour and list.
export function standardRows() {
  return Object.entries(STANDARD_BEHAVIOURS).flatMap(([appliesTo, list]) =>
    list.map(({ isSafety = false, ...behaviour }) => ({ ...behaviour, isSafety, appliesTo })),
  );
}

// Is this list of active criteria already exactly the standard list (same names, same weights)?
export function isStandard(active, appliesTo) {
  const key = (rows) =>
    rows
      .map((r) => `${r.name.toLowerCase()}:${Number(r.weight)}`)
      .sort()
      .join('|');
  return key(active) === key(STANDARD_BEHAVIOURS[appliesTo]);
}
