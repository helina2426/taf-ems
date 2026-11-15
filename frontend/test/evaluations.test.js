// Unit tests for the evaluation rules the frontend uses to decide which buttons to show.
// (The backend checks everything again — these only make sure the screens behave sensibly.)

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canWrite, isApprover, previewScore } from '../src/utils/evaluations.js';

const manager = { role: 'MANAGER' };
const head = { role: 'HOLDING', isPrimaryHoldingUser: true };
const hr = { role: 'HOLDING', isPrimaryHoldingUser: false, canApproveEvaluations: false };
const draft = (type, periodStatus = 'OPEN', status = 'DRAFT') => ({ type, status, period: { status: periodStatus } });

describe('isApprover', () => {
  it('the primary Holding user can approve', () => assert.equal(isApprover(head), true));
  it('another Holding user only with permission', () => {
    assert.equal(isApprover(hr), false);
    assert.equal(isApprover({ ...hr, canApproveEvaluations: true }), true);
  });
  it('a Manager never approves', () => assert.equal(isApprover(manager), false));
});

describe('canWrite', () => {
  it('a Manager writes employee evaluations in an open period', () => assert.equal(canWrite(manager, draft('EMPLOYEE')), true));
  it('but not after submitting', () => assert.equal(canWrite(manager, draft('EMPLOYEE', 'OPEN', 'SUBMITTED')), false));
  it('and not when the period is closed', () => assert.equal(canWrite(manager, draft('EMPLOYEE', 'CLOSED')), false));
  it('a RETURNED evaluation can be fixed', () => assert.equal(canWrite(manager, draft('EMPLOYEE', 'OPEN', 'RETURNED')), true));
  it('only approvers write Manager evaluations', () => {
    assert.equal(canWrite(head, draft('MANAGER')), true);
    assert.equal(canWrite(manager, draft('MANAGER')), false);
  });
});

describe('previewScore', () => {
  const criteria = [
    { id: 'q', weight: 30 },
    { id: 'p', weight: 25 },
    { id: 't', weight: 20 },
    { id: 'c', weight: 25 },
  ];
  it('gives the same 81% as the backend', () => {
    assert.equal(previewScore(criteria, { q: { score: 4 }, p: { score: 5 }, t: { score: 3 }, c: { score: 4 } }), 81);
  });
  it('gives nothing until every criterion has a score', () => {
    assert.equal(previewScore(criteria, { q: { score: 4 } }), null);
  });
});
