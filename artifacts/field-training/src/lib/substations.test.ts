import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CPD_SUBSTATIONS, defaultSubstationForAssignment, getSubstation, substationDisplay } from './substations.js';

test('official directory data includes twenty numbered substations with addresses and phone numbers', () => {
  assert.equal(CPD_SUBSTATIONS.length, 21);
  assert.deepEqual(CPD_SUBSTATIONS.map(station => station.id), [...Array.from({ length: 20 }, (_, index) => String(index + 1)), 'Z4MW']);
  assert.ok(CPD_SUBSTATIONS.filter(station => station.id !== 'Z4MW').every(station => station.address && station.city && station.zip && station.phone));
});

test('company assignments default to their matching precinct station and remain editable', () => {
  assert.equal(defaultSubstationForAssignment({ shift: 'A-Co', zone: '2', precinct: '9' }), '9');
  assert.equal(defaultSubstationForAssignment({ shift: 'C-Co', zone: '4', precinct: '15' }), '15');
  assert.equal(defaultSubstationForAssignment({ shift: 'B-Co', zone: '3', precinct: '4' }), '4');
});

test('midwatch assignments use verified zone station matches and leave unmatched zones blank', () => {
  assert.equal(defaultSubstationForAssignment({ shift: 'DMW', zone: '3', precinct: '10' }), '10');
  assert.equal(defaultSubstationForAssignment({ shift: 'EMW', zone: '6', precinct: '5' }), '5');
  assert.equal(defaultSubstationForAssignment({ shift: 'DMW', zone: '2', precinct: '9' }), '9');
  assert.equal(defaultSubstationForAssignment({ shift: 'EMW', zone: '1', precinct: '1' }), '1');
  assert.equal(defaultSubstationForAssignment({ shift: 'DMW', zone: '5', precinct: '13' }), '13');
  assert.equal(defaultSubstationForAssignment({ shift: 'DMW', zone: '4', precinct: '4' }), 'Z4MW');
  assert.equal(getSubstation('Z4MW')?.address, '743 W. 3rd Ave.');
  assert.equal(getSubstation('zone 4 midwatch')?.zip, '43212');
  assert.equal(substationDisplay('Z4MW'), 'Zone 4 Midwatch · 743 W. 3rd Ave., Columbus, OH 43212');
});

test('substation selections display the official location and phone in print and workbook output', () => {
  assert.equal(getSubstation('Substation 9')?.phone, '(614) 645-4834');
  assert.equal(substationDisplay('9'), 'Substation 9 · 3022 Winchester Pk., Columbus, OH 43232 · (614) 645-4834');
  assert.equal(substationDisplay(''), 'Not recorded');
});
