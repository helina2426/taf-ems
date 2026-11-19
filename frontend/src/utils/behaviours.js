// Helpers for behaviours (version 2, Module 15). Plain functions, unit-tested.
// A behaviour can describe what a score of 1, 2, 3, 4 and 5 looks like ("levelDescriptions").

export const LEVEL_NAMES = ['Not yet', 'Developing', 'Meets expectations', 'Strong', 'Role model'];

// The 5 boxes of the form → what the backend expects: 5 texts, or null when all boxes are empty.
// (If only some boxes are filled, they are all sent, so the backend can say which are missing.)
export function levelsFromForm(boxes) {
  const texts = boxes.map((text) => text.trim());
  return texts.every((text) => text === '') ? null : texts;
}

// "4 · Strong: Spots risks early…" — the hint shown next to a score.
export function levelHint(behaviour, score) {
  if (!score) return '';
  const name = `${score} · ${LEVEL_NAMES[score - 1]}`;
  const text = behaviour.levelDescriptions?.[score - 1];
  return text ? `${name}: ${text}` : name;
}

// Active behaviours first, Safety first, then by weight (biggest first).
export function sortBehaviours(items) {
  return [...items].sort((a, b) => Number(b.isActive) - Number(a.isActive) || Number(b.isSafety) - Number(a.isSafety) || b.weight - a.weight || a.name.localeCompare(b.name));
}
