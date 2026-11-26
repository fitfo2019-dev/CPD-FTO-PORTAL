import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateStandard, FORMULA_VERSION, STD1_VERSION, type Week } from './data';

// Worked examples for the PO Progress standard. Each case can be checked by hand from signed Daily Performance Summaries.
type Opt = { ph?: number; nrt?: number; task?: Record<string, number>; on?: string; signed?: boolean; meeting?: boolean };
const wk = (w: number, uaByCat: Record<number, number>, o: Opt = {}): Week => {
  const UA = Object.values(uaByCat).reduce((a, b) => a + b, 0);
  const uaByTask = o.task ?? Object.fromEntries(Object.entries(uaByCat).flatMap(([c, n]) => Array.from({ length: n }, (_, i) => [`${c}.${i}`, 1])));
  return { w, kind: 'rated', ph: o.ph ?? 2, lim: 0, rated: 5, hours: 40, hoursEdited: false, A: 130 - UA, UA, RT: 0, NO: 20, nrt: o.nrt ?? 0, uaByCat, uaByTask, late: false, signed: o.signed ?? true, ratedOn: o.on ?? '2026-12-06', meeting: o.meeting ?? false };
};
const spread = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 1]));
const last = (weeks: Week[]) => evaluateStandard(weeks).status;
const OLD = '2026-11-15';

test('formula versions are recorded', () => {
  assert.match(FORMULA_VERSION, /^PO-STD-2/);
  assert.match(STD1_VERSION, /^PO-STD-1/);
});

test('weekly totals tighten by phase: I 12/24, II 10/20, III 8/16, IV 5/10', () => {
  const cases: [number, number, number, string][] = [
    [1, 11, 0, 'MEETS STANDARD'], [1, 12, 0, 'EMERGING CONCERN'], [1, 24, 0, 'BELOW STANDARD'],
    [2, 9, 0, 'MEETS STANDARD'], [2, 10, 0, 'EMERGING CONCERN'], [2, 20, 0, 'BELOW STANDARD'],
    [3, 7, 0, 'MEETS STANDARD'], [3, 8, 0, 'EMERGING CONCERN'], [3, 16, 0, 'BELOW STANDARD'],
    [4, 4, 0, 'MEETS STANDARD'], [4, 5, 0, 'EMERGING CONCERN'], [4, 10, 0, 'BELOW STANDARD'],
  ];
  for (const [ph, n, , s] of cases) assert.equal(last([wk(2, spread(n), { ph })]), s, `Phase ${ph}, ${n} UA's`);
});

test('3 UA\'s on the same task in a week is below standard; 3 different tasks in one category is not', () => {
  assert.equal(last([wk(2, { 9: 3 }, { task: { '9.1': 3 } })]), 'BELOW STANDARD');
  assert.equal(last([wk(2, { 9: 3 }, { task: { '9.1': 1, '9.2': 1, '9.3': 1 } })]), 'MEETS STANDARD');
});

test('category rule for the phase: 10-14 emerging, 15+ below, resets at the next phase', () => {
  const four = (w: number, ph = 2) => wk(w, { 14: 4, 3: 1 }, { ph, task: { '14.0': 2, '14.1': 2, '3.0': 1 } });
  assert.equal(last([four(5), four(6)]), 'MEETS STANDARD');
  assert.equal(last([four(5), four(6), four(7)]), 'EMERGING CONCERN');
  const r = evaluateStandard([four(5), four(6), four(7), four(8)]);
  assert.equal(r.status, 'BELOW STANDARD');
  assert.equal(r.calc[3].phaseCatUA, 16);
  assert.equal(last([four(5), four(6), four(7), four(8), wk(9, {}, { ph: 3 })]), 'MEETS STANDARD');
});

test('an NRT holds below standard until the FTO Office records the meeting outcome, then normal rules resume', () => {
  const nrt = wk(5, { 4: 1 }, { nrt: 1 });
  const clean = (w: number, meeting = false) => wk(w, {}, { meeting });
  assert.equal(last([nrt, clean(6), clean(7), clean(8)]), 'BELOW STANDARD');
  assert.equal(last([nrt, clean(6, true)]), 'EMERGING CONCERN');
  assert.equal(last([nrt, clean(6), clean(7), clean(8, true)]), 'MEETS STANDARD');
});

test('status is the highest of the weekly, category and NRT rules', () => {
  const r = evaluateStandard([wk(5, { 4: 1 }, { nrt: 1 }), wk(6, spread(10))]);
  assert.equal(r.status, 'BELOW STANDARD');
  assert.deepEqual(r.calc[1].holds, []);
  const h = evaluateStandard([wk(5, { 4: 1 }, { nrt: 1 }), wk(6, {})]);
  assert.deepEqual(h.calc[1].holds, ['NRT meeting outcome not yet recorded']);
});

test('weeks rated before November 26, 2026 keep PO-STD-1 and are never re-scored', () => {
  const r = evaluateStandard([wk(2, { 13: 3 }, { on: OLD, task: { '13.0': 1, '13.1': 1, '13.2': 1 } })]);
  assert.equal(r.status, 'BELOW STANDARD');
  assert.equal(r.calc[0].version, STD1_VERSION);
  assert.equal(r.calc[0].score, null);
  assert.equal(r.calc[0].scoreNote, 'BEFORE PO-SCORE-2');
  assert.equal(last([wk(2, spread(10), { on: OLD, ph: 4 })]), 'EMERGING CONCERN');
});

test('unsigned weeks do not change status or score', () => {
  const r = evaluateStandard([wk(5, spread(2)), wk(6, spread(25), { signed: false })]);
  assert.equal(r.status, 'MEETS STANDARD');
  assert.equal(r.calc[1].scoreNote, 'PENDING SIGNATURE');
});

test('a meets-standard week steps the weekly rule down one level; a worse week raises it', () => {
  const below = wk(2, spread(20));
  assert.equal(last([below, wk(3, spread(12))]), 'BELOW STANDARD');
  assert.equal(last([below, wk(3, spread(4))]), 'EMERGING CONCERN');
  const r = evaluateStandard([below, wk(3, spread(4)), wk(4, spread(2))]);
  assert.equal(r.status, 'MEETS STANDARD');
  assert.equal(r.clearedWeek, 4);
});

test('limbo and future weeks are not rated and do not count', () => {
  const weeks: Week[] = [{ w: 1, kind: 'limbo', worked: 5 }, wk(2, spread(10)), { w: 3, kind: 'future' }];
  const r = evaluateStandard(weeks);
  assert.equal(r.status, 'EMERGING CONCERN');
  assert.deepEqual(r.calc.map((c) => c.w), [2]);
});

test('late packets never change the PO status', () => {
  const late: Week = { ...(wk(2, spread(3)) as Extract<Week, { kind: 'rated' }>), late: true };
  assert.equal(last([late]), 'MEETS STANDARD');
});

test('a PO never flagged has no PREVIOUSLY FLAGGED week', () => {
  assert.equal(evaluateStandard([wk(2, spread(3)), wk(3, spread(5))]).clearedWeek, null);
});
