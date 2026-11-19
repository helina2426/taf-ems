// Unit tests for the behaviour helpers (src/utils/behaviours.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEVEL_NAMES, levelHint, levelsFromForm, sortBehaviours } from '../src/utils/behaviours.js';

describe('behaviour helpers', () => {
  it('sends null when no level is described, otherwise all 5 texts', () => {
    assert.equal(levelsFromForm(['', ' ', '', '', '']), null);
    assert.deepEqual(levelsFromForm([' a ', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(levelsFromForm(['a', '', '', '', '']), ['a', '', '', '', '']); // the backend explains what is missing
  });

  it('shows the level name and its description next to a score', () => {
    const safety = { levelDescriptions: ['1', '2', '3', 'Spots risks early.', '5'] };
    assert.equal(levelHint(safety, 4), '4 · Strong: Spots risks early.');
    assert.equal(levelHint({ levelDescriptions: null }, 1), `1 · ${LEVEL_NAMES[0]}`);
    assert.equal(levelHint(safety, undefined), '');
  });

  it('lists active behaviours first, Safety first, then by weight', () => {
    const sorted = sortBehaviours([
      { name: 'Old', isActive: false, isSafety: false, weight: 50 },
      { name: 'Teamwork', isActive: true, isSafety: false, weight: 15 },
      { name: 'Safety', isActive: true, isSafety: true, weight: 20 },
      { name: 'Integrity', isActive: true, isSafety: false, weight: 20 },
    ]);
    assert.deepEqual(sorted.map((b) => b.name), ['Safety', 'Integrity', 'Teamwork', 'Old']);
  });
});
