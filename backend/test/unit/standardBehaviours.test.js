// Unit tests for the standard behaviour lists (Module 15).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_NAMES, STANDARD_BEHAVIOURS, isStandard, standardRows } from '../../src/modules/criteria/standardBehaviours.js';

describe('standard behaviours', () => {
  test('employees have 6 behaviours, Managers the same 6 + Leadership + Planning', () => {
    const names = (list) => STANDARD_BEHAVIOURS[list].map((b) => b.name);
    assert.equal(names('EMPLOYEE').length, 6);
    assert.equal(names('MANAGER').length, 8);
    for (const name of names('EMPLOYEE')) assert.ok(names('MANAGER').includes(name), `${name} is also a Manager behaviour`);
    assert.ok(names('MANAGER').includes('Leadership'));
    assert.ok(names('MANAGER').includes('Planning & decision-making'));
  });

  test('the weights of each list add up to exactly 100', () => {
    for (const list of ['EMPLOYEE', 'MANAGER']) {
      assert.equal(STANDARD_BEHAVIOURS[list].reduce((sum, b) => sum + b.weight, 0), 100, list);
    }
  });

  test('each list has exactly one Safety behaviour', () => {
    for (const list of ['EMPLOYEE', 'MANAGER']) {
      assert.deepEqual(STANDARD_BEHAVIOURS[list].filter((b) => b.isSafety).map((b) => b.name), ['Safety'], list);
    }
  });

  test('every behaviour describes all 5 levels', () => {
    assert.equal(LEVEL_NAMES.length, 5);
    for (const row of standardRows()) {
      assert.equal(row.levelDescriptions.length, 5, row.name);
      for (const text of row.levelDescriptions) assert.ok(text.length >= 2 && text.length <= 300, row.name);
    }
  });

  test('standardRows gives 14 rows, each with its list and a true/false safety flag', () => {
    const rows = standardRows();
    assert.equal(rows.length, 14);
    assert.ok(rows.every((r) => ['EMPLOYEE', 'MANAGER'].includes(r.appliesTo) && typeof r.isSafety === 'boolean'));
  });

  test('isStandard recognises the standard list, whatever the order or capital letters', () => {
    const active = [...STANDARD_BEHAVIOURS.EMPLOYEE].reverse().map((b) => ({ name: b.name.toUpperCase(), weight: String(b.weight) }));
    assert.equal(isStandard(active, 'EMPLOYEE'), true);
    assert.equal(isStandard(active.slice(1), 'EMPLOYEE'), false);
    assert.equal(isStandard([{ name: 'Quality of work', weight: 30 }], 'EMPLOYEE'), false);
  });
});
