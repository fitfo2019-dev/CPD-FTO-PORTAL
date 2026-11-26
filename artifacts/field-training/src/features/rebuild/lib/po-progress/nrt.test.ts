import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adviseNrt, NRT_RULE_VERSION, type Occurrence } from './nrt';

// Worked examples for the NRT recommendation (PO-NRT-1). Example task: PO failed to recognize a weapon on a person.
const o = (id: string, phase: number, at: string, retrainedAt: string | null, task = '10.2'): Occurrence => ({ id, phase, task, at, retrainedAt, retrainMinutes: retrainedAt ? 15 : null });

test('rule version is recorded', () => {
  assert.match(NRT_RULE_VERSION, /^PO-NRT-1/);
});

test('3rd failure on the same task, both earlier ones retrained before the next failure, recommends NRT', () => {
  const a = o('a', 2, '2026-12-01T10:00', '2026-12-01T11:00');
  const b = o('b', 2, '2026-12-03T10:00', '2026-12-03T10:30');
  const r = adviseNrt([a, b], o('c', 2, '2026-12-05T09:00', null));
  assert.equal(r.kind, 'nrt');
  assert.deepEqual(r.kind === 'nrt' && r.current.map((x) => x.id), ['a', 'b']);
});

test('two failures on separate runs in one shift count when retraining came in between', () => {
  const a = o('a', 3, '2026-12-01T10:00', '2026-12-01T10:20');
  const b = o('b', 3, '2026-12-01T13:00', '2026-12-01T13:15');
  assert.equal(adviseNrt([a, b], o('c', 3, '2026-12-01T17:00', null)).kind, 'nrt');
});

test('three different tasks in one category, each retrained once, is not an NRT', () => {
  const a = o('a', 2, '2026-12-01T10:00', '2026-12-01T11:00', '10.1');
  const b = o('b', 2, '2026-12-03T10:00', '2026-12-03T11:00', '10.2');
  assert.equal(adviseNrt([a, b], o('c', 2, '2026-12-05T10:00', null, '10.3')).kind, 'none');
});

test('missing or late retraining prompts a corrective training entry, not an NRT', () => {
  const a = o('a', 2, '2026-12-01T10:00', null);
  const b = o('b', 2, '2026-12-03T10:00', '2026-12-03T11:00');
  const r = adviseNrt([a, b], o('c', 2, '2026-12-05T10:00', null));
  assert.equal(r.kind, 'retrain');
  assert.deepEqual(r.kind === 'retrain' && r.missing.map((x) => x.id), ['a']);
  // Retraining documented after the next failure does not count.
  const late = o('a', 2, '2026-12-01T10:00', '2026-12-04T10:00');
  assert.equal(adviseNrt([late, b], o('c', 2, '2026-12-05T10:00', null)).kind, 'retrain');
});

test('only the current phase counts; retrained earlier-phase failures are listed as supporting entries', () => {
  const p1 = o('p1', 1, '2026-11-02T10:00', '2026-11-02T11:00');
  const p1x = o('p1x', 1, '2026-11-04T10:00', null);
  const a = o('a', 2, '2026-12-01T10:00', '2026-12-01T11:00');
  assert.equal(adviseNrt([p1, a], o('c', 2, '2026-12-05T10:00', null)).kind, 'none');
  const b = o('b', 2, '2026-12-03T10:00', '2026-12-03T11:00');
  const r = adviseNrt([p1, p1x, a, b], o('c', 2, '2026-12-05T10:00', null));
  assert.deepEqual(r.kind === 'nrt' && r.earlier.map((x) => x.id), ['p1']);
});

test('a dismissed recommendation returns on the next UA for that task', () => {
  const a = o('a', 2, '2026-12-01T10:00', '2026-12-01T11:00');
  const b = o('b', 2, '2026-12-03T10:00', '2026-12-03T11:00');
  const c = o('c', 2, '2026-12-05T10:00', '2026-12-05T11:00');
  assert.equal(adviseNrt([a, b, c], o('d', 2, '2026-12-07T10:00', null)).kind, 'nrt');
});
