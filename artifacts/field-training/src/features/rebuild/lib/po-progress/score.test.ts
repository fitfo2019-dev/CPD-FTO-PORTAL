import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NRT_PHASE_CAP, NRT_UA_WEIGHT, phaseScore, SCORE_VERSION, unitScore, weekScore, weekUnits } from './data';

// Worked examples for the advisory PO Progress score (PO-SCORE-1). Each case can be checked by hand from signed Daily Performance Summaries.

test('score version is recorded', () => {
  assert.match(SCORE_VERSION, /^PO-SCORE-1/);
  assert.equal(NRT_UA_WEIGHT, 20);
  assert.equal(NRT_PHASE_CAP, 60);
});

test('UA scale: 2 points per UA through 20, then 1 point, 0% at 80', () => {
  const cases: [number, number][] = [[0, 100], [5, 90], [10, 80], [15, 70], [20, 60], [25, 55], [30, 50], [40, 40], [79, 1], [80, 0], [120, 0]];
  for (const [ua, score] of cases) assert.equal(unitScore(ua), score, `${ua} UA's`);
});

test('each NRT replaces its paired UA and counts as 20 UAs', () => {
  assert.equal(weekUnits({ UA: 1, nrt: 1 }), 20);
  assert.equal(weekScore({ UA: 1, nrt: 1 }), 60);
  assert.equal(weekScore({ UA: 6, nrt: 1 }), 55);
  assert.equal(weekScore({ UA: 2, nrt: 2 }), 40);
  assert.equal(weekScore({ UA: 3, nrt: 3 }), 20);
  assert.equal(weekScore({ UA: 4, nrt: 4 }), 0);
});

test('an NRT week is always at or below the Below Standard line', () => {
  for (let ua = 1; ua <= 40; ua++) assert.ok(weekScore({ UA: ua, nrt: 1 }) <= 60);
});

test('RT ratings do not affect the score', () => {
  assert.equal(weekScore({ UA: 0, nrt: 0 }), 100);
});

test('phase score averages rated weeks to one decimal', () => {
  assert.equal(phaseScore([{ UA: 0, nrt: 0 }, { UA: 5, nrt: 0 }, { UA: 10, nrt: 0 }]), 90);
  assert.equal(phaseScore([{ UA: 1, nrt: 0 }, { UA: 2, nrt: 0 }, { UA: 2, nrt: 0 }]), 96.7);
  assert.equal(phaseScore([]), null);
});

test('a phase with an NRT is held to 60% or lower', () => {
  assert.equal(phaseScore([{ UA: 1, nrt: 1 }, { UA: 0, nrt: 0 }, { UA: 0, nrt: 0 }, { UA: 0, nrt: 0 }]), 60);
  assert.equal(phaseScore([{ UA: 2, nrt: 2 }, { UA: 1, nrt: 1 }]), 50);
});
