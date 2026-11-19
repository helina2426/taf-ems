// Unit tests for appeals (Module 18).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { appealDeadline, decisionResult, whyCannotDecide, whyNoAppeal } from '../../src/modules/appeals/appeal.rules.js';

const ack = new Date('2026-11-19T10:00:00Z');
const ok = { status: 'PUBLISHED', rating: 'PARTIALLY_MEETS', acknowledgedAt: ack, hasAppeal: false, appealDays: 14, now: new Date('2026-11-20T10:00:00Z') };

describe('who may appeal, and when', () => {
  test('a low, published, acknowledged rating within 14 days can be appealed', () => {
    assert.equal(whyNoAppeal(ok), null);
    assert.equal(whyNoAppeal({ ...ok, rating: 'DOES_NOT_MEET' }), null);
  });
  test('the deadline is 14 days after the acknowledgement', () => {
    assert.equal(appealDeadline(ack, 14).toISOString(), '2026-12-03T10:00:00.000Z');
    assert.equal(whyNoAppeal({ ...ok, now: new Date('2026-12-03T09:59:00Z') }), null);
    assert.match(whyNoAppeal({ ...ok, now: new Date('2026-12-03T10:01:00Z') }), /14 days/);
  });
  test('good ratings, unpublished or unread evaluations, and second appeals cannot', () => {
    assert.match(whyNoAppeal({ ...ok, rating: 'SUCCESSFULLY_MEETS' }), /Partially meets/);
    assert.match(whyNoAppeal({ ...ok, rating: 'EXCEEDS' }), /Partially meets/);
    assert.match(whyNoAppeal({ ...ok, status: 'APPROVED' }), /published/);
    assert.match(whyNoAppeal({ ...ok, rating: null }), /plan-based/);
    assert.match(whyNoAppeal({ ...ok, acknowledgedAt: null }), /Acknowledge/);
    assert.match(whyNoAppeal({ ...ok, hasAppeal: true }), /one appeal/);
  });
});

describe('who decides', () => {
  const evaluation = { evaluatorId: 'selam', approverIds: ['head'] };
  const approver = (id, extra = {}) => ({ id, role: 'HOLDING', isPrimaryHoldingUser: false, canApproveEvaluations: true, ...extra });
  test('another approver can decide', () => {
    assert.equal(whyCannotDecide(approver('reviewer'), evaluation), null);
  });
  test('not the person who approved it, not the one who wrote it, not a Manager or someone without permission', () => {
    assert.match(whyCannotDecide(approver('head', { isPrimaryHoldingUser: true }), evaluation), /approved/);
    assert.match(whyCannotDecide(approver('selam'), evaluation), /wrote/);
    assert.match(whyCannotDecide({ id: 'x', role: 'MANAGER' }, evaluation), /Holding user/);
    assert.match(whyCannotDecide(approver('hr', { canApproveEvaluations: false }), evaluation), /Holding user/);
  });
});

describe('the decision', () => {
  test('rating kept: nothing new', () => {
    assert.deepEqual(decisionResult({ outcome: 'RATING_KEPT' }, 'PARTIALLY_MEETS'), { outcome: 'RATING_KEPT', newRating: null, newScore: null });
  });
  test('rating changed: the new rating comes from the new score', () => {
    assert.deepEqual(decisionResult({ outcome: 'RATING_CHANGED', newScore: 76 }, 'PARTIALLY_MEETS'), { outcome: 'RATING_CHANGED', newRating: 'SUCCESSFULLY_MEETS', newScore: 76 });
  });
  test('a "change" that gives the same rating, or no score, is refused', () => {
    assert.match(decisionResult({ outcome: 'RATING_CHANGED', newScore: 70 }, 'PARTIALLY_MEETS').error, /same rating/);
    assert.match(decisionResult({ outcome: 'RATING_CHANGED' }, 'PARTIALLY_MEETS').error, /new score/);
  });
});
