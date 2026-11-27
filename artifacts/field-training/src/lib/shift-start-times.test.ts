import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentShiftStartTime } from './shift-start-times.js';

test('start time follows the precinct and company from the 2019 patrol schedule', () => {
  assert.equal(assignmentShiftStartTime('A-Co', '15'), '07:00');
  assert.equal(assignmentShiftStartTime('A-Co', '17'), '06:00');
  assert.equal(assignmentShiftStartTime('B-Co', '9'), '14:00');
  assert.equal(assignmentShiftStartTime('B-Co', '13'), '15:00');
  assert.equal(assignmentShiftStartTime('C-Co', '20'), '22:00');
  assert.equal(assignmentShiftStartTime('C-Co', '1'), '23:00');
});

test('midwatch start times do not depend on the precinct', () => {
  assert.equal(assignmentShiftStartTime('DMW', '15'), '09:00');
  assert.equal(assignmentShiftStartTime('EMW', ''), '19:00');
});

test('an assignment outside the table is left for the FTO to enter', () => {
  assert.equal(assignmentShiftStartTime('A-Co', '21'), '');
  assert.equal(assignmentShiftStartTime('Day', '15'), '');
});
