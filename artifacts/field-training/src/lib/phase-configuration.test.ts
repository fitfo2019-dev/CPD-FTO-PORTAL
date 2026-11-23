import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PHASE_TIMELINE_REGISTRY,
  PHASE_LENGTH_WEEKS,
  PHASE_LIMBO_FULL_WEEKS,
  PHASE_LIMBO_WORKDAYS,
  PHASE_PROGRAM_WEEK_START,
  TOTAL_TRAINING_WEEKS,
} from '../config/phaseConfiguration.js';

test('phase registry keeps the approved four-phase schedule and Limbo boundaries',()=>{
  assert.deepEqual(PHASE_TIMELINE_REGISTRY.map(({phase,durationInWeeks})=>({phase,durationInWeeks})),[
    {phase:1,durationInWeeks:4},{phase:2,durationInWeeks:4},{phase:3,durationInWeeks:4},{phase:4,durationInWeeks:3},
  ]);
  assert.deepEqual(PHASE_LENGTH_WEEKS,{1:4,2:4,3:4,4:3});
  assert.deepEqual(PHASE_PROGRAM_WEEK_START,{1:1,2:5,3:9,4:13});
  assert.deepEqual(PHASE_LIMBO_FULL_WEEKS,[1]);
  assert.deepEqual(PHASE_LIMBO_WORKDAYS,{1:0,2:2,3:1,4:1});
  assert.equal(TOTAL_TRAINING_WEEKS,15);
});
