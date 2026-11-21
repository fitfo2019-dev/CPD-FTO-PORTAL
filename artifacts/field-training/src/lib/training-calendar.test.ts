import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPhaseEndDate } from './training-calendar';

test('phase end dates use complete Sunday–Saturday training weeks',()=>{
  assert.equal(getPhaseEndDate(1,'2026-01-04'),'2026-01-31');
  assert.equal(getPhaseEndDate(4,'2026-01-07'),'2026-01-24');
});

test('invalid phase dates do not produce a date range',()=>{
  assert.equal(getPhaseEndDate(2,'not-a-date'),undefined);
});
