import assert from 'node:assert/strict';
import test from 'node:test';
import { assignmentsForLawReview, lawReviewId } from './law-review.js';
import type { TrainingAssignment } from './model.js';

const assignments: TrainingAssignment[] = [
  { id: 'a1', className: '135th', recruitName: 'PO One', recruitBadge: '1001', recruitEmail: 'one@dept.gov', ftoBadge: '2001', phase: 1, phaseStartDate: '2026-01-04' },
  { id: 'a2', className: '135th', recruitName: 'PO Two', recruitBadge: '1002', recruitEmail: 'two@dept.gov', ftoBadge: '2002', phase: 1, phaseStartDate: '2026-01-04' },
];

test('law-review display filters PO and FTO assignments by account mapping', () => {
  assert.deepEqual(assignmentsForLawReview('po', assignments, ' ONE@dept.gov '), [assignments[0]]);
  assert.deepEqual(assignmentsForLawReview('fto', assignments, undefined, '2002'), [assignments[1]]);
  assert.deepEqual(assignmentsForLawReview('fto', assignments), []);
});

test('coordinator can select the roster; read-only and technical roles get no review controls', () => {
  assert.deepEqual(assignmentsForLawReview('fto_coordinator', assignments), assignments);
  assert.deepEqual(assignmentsForLawReview('fto_coc', assignments), []);
  assert.deepEqual(assignmentsForLawReview('policenet', assignments), []);
});

test('review record IDs stay distinct by assignment and source', () => {
  assert.notEqual(lawReviewId('a1', 'orc-2903-13'), lawReviewId('a2', 'orc-2903-13'));
  assert.notEqual(lawReviewId('a1', 'orc-2903-13'), lawReviewId('a1', 'ccc-2303-13'));
});
