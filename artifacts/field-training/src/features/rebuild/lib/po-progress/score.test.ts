import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateStandard, NRT_PHASE_CAP, NRT_UA_WEIGHT, perForty, phaseScore, phaseScores, SCORE_VERSION, unitScore, weekScore, weekUnits, type Week } from './data';

// Worked examples for the advisory PO Progress score (PO-SCORE-2). Each case can be checked by hand from signed Daily Performance Summaries.
const wk = (w: number, UA: number, o: { hours?: number; nrt?: number; ph?: number; cat?: number } = {}): Week => ({
  w, kind: 'rated', ph: o.ph ?? 2, lim: 0, rated: 5, hours: o.hours ?? 40, hoursEdited: false, A: 100, UA, RT: 0, NO: 0, nrt: o.nrt ?? 0,
  uaByCat: o.cat != null ? { [o.cat]: UA } : Object.fromEntries(Array.from({ length: UA }, (_, i) => [i, 1])),
  uaByTask: Object.fromEntries(Array.from({ length: UA }, (_, i) => [`${o.cat ?? i}.${i}`, 1])), late: false, signed: true, ratedOn: '2026-12-06', meeting: false,
});

test('score version is recorded', () => {
  assert.match(SCORE_VERSION, /^PO-SCORE-2/);
  assert.equal(NRT_UA_WEIGHT, 20);
  assert.equal(NRT_PHASE_CAP, 60);
});

test('UA scale: 2 points per UA through 20, then 1 point, 0% at 80', () => {
  const cases: [number, number][] = [[0, 100], [5, 90], [10, 80], [15, 70], [20, 60], [25, 55], [30, 50], [40, 40], [79, 1], [80, 0], [120, 0], [1.7, 96.6]];
  for (const [ua, score] of cases) assert.equal(unitScore(ua), score, `${ua} UA's`);
});

test('each NRT replaces its paired UA and counts as 20 UA\'s', () => {
  assert.equal(weekUnits({ UA: 1, nrt: 1 }), 20);
  assert.equal(weekUnits({ UA: 6, nrt: 1 }), 25);
  assert.equal(weekUnits({ UA: 4, nrt: 4 }), 80);
});

test('counts are scaled to 40 rated hours, one decimal', () => {
  assert.equal(perForty(1, 24), 1.7);
  assert.equal(perForty(4, 40), 4);
  assert.equal(perForty(4, 20), 8);
  // 4x10 and 5x8 full weeks score alike.
  assert.equal(weekScore({ UA: 4, nrt: 0, hours: 40 }), 92);
  // A short limbo week: 2 UA's in 24 hours counts as 3.3.
  assert.equal(weekScore({ UA: 2, nrt: 0, hours: 24 }), 93.4);
});

test('week score is held to the cap for its Status After: Below 60%, Emerging 80%', () => {
  assert.equal(weekScore({ UA: 3, nrt: 0, hours: 40 }, 'BELOW STANDARD'), 60);
  assert.equal(weekScore({ UA: 3, nrt: 0, hours: 40 }, 'EMERGING CONCERN'), 80);
  assert.equal(weekScore({ UA: 30, nrt: 0, hours: 40 }, 'BELOW STANDARD'), 50);
  for (let ua = 1; ua <= 40; ua++) assert.ok(evaluateStandard([wk(5, ua, { nrt: 1 })]).calc[0].score! <= 60);
});

test('RT ratings do not affect the score', () => {
  const a = wk(5, 2), b = { ...(wk(5, 2) as Extract<Week, { kind: 'rated' }>), RT: 12 };
  assert.equal(evaluateStandard([a]).calc[0].score, evaluateStandard([b]).calc[0].score);
});

test('phase score averages scored weeks to one decimal, with phase caps', () => {
  assert.equal(phaseScore([100, 90, 80], { nrt: 0, catMax: 0 }), 90);
  assert.equal(phaseScore([98, 96, 96], { nrt: 0, catMax: 0 }), 96.7);
  assert.equal(phaseScore([], { nrt: 0, catMax: 0 }), null);
  assert.equal(phaseScore([60, 100, 100, 100], { nrt: 1, catMax: 0 }), 60);
  assert.equal(phaseScore([96, 96, 96], { nrt: 0, catMax: 15 }), 60);
  assert.equal(phaseScore([96, 96, 96], { nrt: 0, catMax: 10 }), 80);
});

test('phase scores from the calculation table match by hand', () => {
  const r = evaluateStandard([wk(5, 2, { hours: 24 }), wk(6, 4), wk(7, 0), wk(8, 6, { ph: 2 })]);
  // 2 UA's in 24 hours = 3.3 → 93.4; 4 → 92; 0 → 100; 6 → 88. Average 373.4 ÷ 4 = 93.35, rounds to 93.4.
  assert.deepEqual(r.calc.map((c) => c.score), [93.4, 92, 100, 88]);
  assert.equal(phaseScores(r.calc)[1], 93.4);
});
