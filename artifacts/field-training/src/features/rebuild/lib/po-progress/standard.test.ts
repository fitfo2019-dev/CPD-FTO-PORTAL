import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateStandard, FORMULA_VERSION, type Week } from './data';

// Worked examples for the PO Progress standard (PO-STD-1). Each case can be checked by hand from a Daily Performance Summary packet.
const wk = (w: number, uaByCat: Record<number, number>, nrt = 0): Week => {
  const UA = Object.values(uaByCat).reduce((a, b) => a + b, 0);
  return { w, kind: 'rated', ph: 1, lim: 0, rated: 5, A: 130 - UA, UA, RT: 0, NO: 20, nrt, uaByCat, late: false };
};
const spread = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 1]));
const last = (weeks: Week[]) => evaluateStandard(weeks).status;

test('formula version is recorded', () => {
  assert.match(FORMULA_VERSION, /^PO-STD-1/);
});

test('weekly bands: 0-9 meets, 10-19 emerging, 20+ below', () => {
  assert.equal(last([wk(2, spread(0))]), 'MEETS STANDARD');
  assert.equal(last([wk(2, spread(8))]), 'MEETS STANDARD');
  assert.equal(last([wk(2, spread(9))]), 'MEETS STANDARD');
  assert.equal(last([wk(2, spread(10))]), 'EMERGING CONCERN');
  assert.equal(last([wk(2, spread(19))]), 'EMERGING CONCERN');
  assert.equal(last([wk(2, spread(20))]), 'BELOW STANDARD');
});

test('3 UA\'s in one category in a week, or an NRT, is below standard', () => {
  assert.equal(last([wk(2, { 13: 3 })]), 'BELOW STANDARD');
  assert.equal(last([wk(2, { 13: 2, 4: 1 })]), 'MEETS STANDARD');
  assert.equal(last([wk(2, { 4: 1 }, 1)]), 'BELOW STANDARD');
});

test('a meets-standard week steps down one level; a worse week raises the status', () => {
  const below = wk(2, spread(20));
  assert.equal(last([below, wk(3, spread(12))]), 'BELOW STANDARD');
  assert.equal(last([below, wk(3, spread(4))]), 'EMERGING CONCERN');
  const r = evaluateStandard([below, wk(3, spread(4)), wk(4, spread(2))]);
  assert.equal(r.status, 'MEETS STANDARD');
  assert.equal(r.clearedWeek, 4);
  assert.equal(last([wk(2, spread(10)), wk(3, spread(25))]), 'BELOW STANDARD');
});

test('limbo and future weeks are not rated and do not count', () => {
  const weeks: Week[] = [{ w: 1, kind: 'limbo', worked: 5 }, wk(2, spread(10)), { w: 3, kind: 'future' }];
  const r = evaluateStandard(weeks);
  assert.equal(r.status, 'EMERGING CONCERN');
  assert.deepEqual(r.calc.map(c => c.w), [2]);
});

test('late packets never change the PO status', () => {
  const late: Week = { ...(wk(2, spread(3)) as Extract<Week, { kind: 'rated' }>), late: true };
  assert.equal(last([late]), 'MEETS STANDARD');
});

test('a PO never flagged has no PREVIOUSLY FLAGGED week', () => {
  assert.equal(evaluateStandard([wk(2, spread(3)), wk(3, spread(5))]).clearedWeek, null);
});
