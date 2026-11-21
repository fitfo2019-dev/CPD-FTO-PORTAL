import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterRows } from './assignment-import.js';
import { cruiserDistrictForFtoAssignment, ftoAssignmentsForPrecinct } from './cpd-geography.js';
import { formatDateMDY, parseDateMDY } from './training-calendar.js';

test('roster import aggregates FTOs and validates assignment rows',()=>{
  const parsed=parseRosterRows([
    ['Training Class','PO Name','PO Badge','PO Email','FTO Name','FTO Badge','FTO Email','Phase','Phase Start Date','Shift','Days Off','Zone','Precinct','FTO Assignment'],
    ['Class 27-A','Officer Example','0071','po@example.gov','Trainer Example','0020','fto@example.gov','2','03/09/2027','DMW','Sunday;Monday;Tuesday','1','1','9010D1'],
    ['','','','','Trainer Example','0020','fto@example.gov','','','','','','',''],
  ]);
  assert.equal(parsed.errors.length,0);
  assert.equal(parsed.ftos.length,1);
  assert.equal(parsed.ftos[0].badge,'0020');
  assert.equal(parsed.assignments.length,1);
  assert.equal(parsed.assignments[0].phaseStartDate,'2027-03-09');
  assert.equal(parsed.assignments[0].ftoAssignment,'9010D1');
  assert.equal(parsed.assignments[0].cruiserDistrict,'9010');
  assert.deepEqual(parsed.assignments[0].daysOff,[0,1,2]);
});

test('roster import keeps FTO-only rows but rejects invalid phases, shifts, and off-day counts',()=>{
  const parsed=parseRosterRows([
    ['Class','PO Name','PO Badge','FTO Name','FTO Badge','Phase','Start Date','Shift','Days Off'],
    ['Class 27-A','Officer Example','0071','Trainer Example','0020','9','03/09/2027','DMW','Sunday;Monday'],
    ['','','','Backup FTO','0099','','','',''],
  ]);
  assert.equal(parsed.ftos.length,2);
  assert.equal(parsed.assignments.length,0);
  assert.ok(parsed.errors[0].includes('phase must be'));
  assert.ok(parsed.errors[0].includes('requires 3 days off'));
});

test('FTO assignment suffixes follow the selected shift',()=>{
  assert.deepEqual(ftoAssignmentsForPrecinct('1','1','A-Co').slice(0,2),['10A','11A']);
  assert.deepEqual(ftoAssignmentsForPrecinct('1','1','DMW').slice(0,2),['9010D1','9010D2']);
  assert.deepEqual(ftoAssignmentsForPrecinct('1','1','EMW').slice(0,2),['9010E1','9010E2']);
  assert.deepEqual(ftoAssignmentsForPrecinct('1','1','B-Co').slice(0,2),['10B','11B']);
  assert.deepEqual(ftoAssignmentsForPrecinct('1','1','C-Co').slice(0,2),['10C','11C']);
  assert.ok(!ftoAssignmentsForPrecinct('1','1','A-Co').includes('9010A'));
  assert.ok(!ftoAssignmentsForPrecinct('1','1','B-Co').includes('9010B'));
  assert.ok(!ftoAssignmentsForPrecinct('1','1','C-Co').includes('9010C'));
  assert.equal(cruiserDistrictForFtoAssignment('1','1','9010E1','DMW'),undefined);
  assert.equal(cruiserDistrictForFtoAssignment('1','1','9010A','A-Co'),undefined);
  assert.equal(cruiserDistrictForFtoAssignment('1','1','9010D2','DMW'),'9010');
});

test('dates are displayed and accepted only as MM/DD/YYYY',()=>{
  assert.equal(formatDateMDY('2027-03-09'),'03/09/2027');
  assert.equal(parseDateMDY('03/09/2027'),'2027-03-09');
  assert.equal(parseDateMDY('2027-03-09'),undefined);
  assert.equal(parseDateMDY('13/03/2027'),undefined);
});
