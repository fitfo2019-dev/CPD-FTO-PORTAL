import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAFFIC_DATA_COLLECTION_KEY as key, applyTrafficDataCollectionRule, trafficDataCollectionNotApplicable } from './traffic-data-collection.js';

const base = { runKind: 'traffic_stop' as const, checklist: {} as Record<string, boolean>, checklistNotApplicable: {} as Record<string, true>, activityFlags: {} };

test('dispatched traffic stops leave the Traffic Data Collection box blank with no UA', () => {
  const next = applyTrafficDataCollectionRule({ ...base, isDispatched: true });
  assert.equal(next.checklist[key], false);
  assert.equal(next.checklistNotApplicable[key], true);
  assert.equal(trafficDataCollectionNotApplicable({ runKind: 'traffic_stop', isDispatched: true }, key), true);
  assert.equal(trafficDataCollectionNotApplicable({ runKind: 'traffic_stop', isDispatched: false }, key), false);
  const same = applyTrafficDataCollectionRule({ ...base, isDispatched: true, ...next });
  assert.equal(same.checklist, next.checklist);
});

test('self-initiated stops require the box and Solve Citation/Summons completes it', () => {
  const failed = applyTrafficDataCollectionRule({ ...base, isDispatched: false, checklist: { [key]: false } });
  assert.equal(failed.checklist[key], false);
  const solved = applyTrafficDataCollectionRule({ ...base, isDispatched: false, checklist: { [key]: false }, activityFlags: { solveCitationSummons: true } });
  assert.equal(solved.checklist[key], true);
  const switched = applyTrafficDataCollectionRule({ ...base, isDispatched: false, checklist: { [key]: false }, checklistNotApplicable: { [key]: true } });
  assert.equal(switched.checklist[key], true);
  assert.equal(switched.checklistNotApplicable[key], undefined);
});

test('other run forms are untouched', () => {
  const input = { ...base, runKind: 'call_for_service' as const, isDispatched: true };
  const next = applyTrafficDataCollectionRule(input);
  assert.equal(next.checklist, input.checklist);
});
