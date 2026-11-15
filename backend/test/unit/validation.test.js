// Unit tests for some validation rules (what the API accepts and refuses).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCompanySchema } from '../../src/modules/companies/company.validation.js';
import { saveScoresSchema } from '../../src/modules/evaluations/evaluation.validation.js';
import { returnSchema } from '../../src/modules/evaluations/evaluation.validation.js';
import { strongPassword, requiredEmail } from '../../src/shared/validation.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('strongPassword', () => {
  const schema = strongPassword();
  it('accepts a password with letters and numbers, 8+ characters', () => assert.ok(schema.safeParse('ChangeMe123').success));
  it('refuses a short password', () => assert.equal(schema.safeParse('Ab1').success, false));
  it('refuses a password without a number', () => assert.equal(schema.safeParse('OnlyLetters').success, false));
  it('refuses a password without a letter', () => assert.equal(schema.safeParse('12345678').success, false));
});

describe('requiredEmail', () => {
  it('removes spaces and makes it lowercase', () => assert.equal(requiredEmail.parse('  Head@Demo.LOCAL '), 'head@demo.local'));
  it('refuses something that is not an email', () => assert.equal(requiredEmail.safeParse('not-an-email').success, false));
});

describe('createCompanySchema', () => {
  it('turns the code into capitals', () => {
    assert.equal(createCompanySchema.parse({ name: 'Taf Solar', code: 'taf-solar' }).code, 'TAF-SOLAR');
  });
  it('refuses a code with spaces', () => {
    assert.equal(createCompanySchema.safeParse({ name: 'Taf Solar', code: 'taf solar' }).success, false);
  });
  it('turns an empty optional field into null', () => {
    assert.equal(createCompanySchema.parse({ name: 'Taf Solar', code: 'TS', phone: '' }).phone, null);
  });
});

describe('saveScoresSchema', () => {
  it('accepts whole scores from 1 to 5', () => {
    assert.ok(saveScoresSchema.safeParse({ scores: [{ criterionId: ID_A, score: 1 }, { criterionId: ID_B, score: 5 }] }).success);
  });
  it('refuses a score of 6', () => assert.equal(saveScoresSchema.safeParse({ scores: [{ criterionId: ID_A, score: 6 }] }).success, false));
  it('refuses a score of 3.5', () => assert.equal(saveScoresSchema.safeParse({ scores: [{ criterionId: ID_A, score: 3.5 }] }).success, false));
  it('refuses the same criterion twice', () => {
    const result = saveScoresSchema.safeParse({ scores: [{ criterionId: ID_A, score: 3 }, { criterionId: ID_A, score: 4 }] });
    assert.equal(result.success, false);
  });
});

describe('returnSchema (returning an evaluation)', () => {
  it('requires a reason of at least 10 characters', () => {
    assert.equal(returnSchema.safeParse({ comment: 'too short' }).success, false);
    assert.ok(returnSchema.safeParse({ comment: 'Please check the Teamwork score again.' }).success);
  });
});
