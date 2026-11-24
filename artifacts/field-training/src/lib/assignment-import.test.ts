import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterRows } from './assignment-import.js';
import { CPD_GEOGRAPHY, cruiserDistrictForFtoAssignment, ftoAssignmentsForPrecinct, ftoCruiserDistrictsForShift, isValidFtoAssignment } from './cpd-geography.js';
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

test('universal assignment codes are offered for every mapped precinct and supported shift with real district context',()=>{
  const shifts=['A-Co','B-Co','C-Co','DMW','EMW'];
  for(const zone of CPD_GEOGRAPHY) for(const precinct of zone.precincts) for(const shift of shifts) {
    const options=ftoAssignmentsForPrecinct(zone.zone,precinct.precinct,shift);
    const compatibleDistricts=ftoCruiserDistrictsForShift(zone.zone,precinct.precinct,shift);
    const compatibleDistrict=compatibleDistricts[0];
    assert.ok(compatibleDistrict,`${zone.zone}/${precinct.precinct}/${shift} has a mapped district`);
    for(const code of ['80C-1','80C-2']) {
      assert.ok(options.includes(code),`${zone.zone}/${precinct.precinct}/${shift} offers ${code}`);
      assert.equal(isValidFtoAssignment(zone.zone,precinct.precinct,code,shift,compatibleDistrict),true);
      assert.equal(cruiserDistrictForFtoAssignment(zone.zone,precinct.precinct,code,shift),undefined);
      assert.equal(isValidFtoAssignment(zone.zone,precinct.precinct,code,shift,'80'),compatibleDistricts.includes('80'));
    }
  }
  assert.equal(isValidFtoAssignment('2','1','80C-1','A-Co','10'),false);
  assert.equal(isValidFtoAssignment('1','1','80C-2','DMW','10'),false);
  assert.equal(ftoAssignmentsForPrecinct('1','1','unknown').length,0);
});

test('roster import preserves and checks a universal assignment mapped district',()=>{
  const headers=['Class','PO Name','PO Badge','FTO Name','FTO Badge','Phase Start Date','Shift','Days Off','Zone','Precinct','Cruiser District','FTO Assignment'];
  const valid=parseRosterRows([
    headers,
    ['Class 27-A','Officer Example','0071','Trainer Example','0020','03/09/2027','DMW','Sunday;Monday;Tuesday','1','1','9010','80C-1'],
  ]);
  assert.deepEqual(valid.errors,[]);
  assert.equal(valid.assignments[0]?.ftoAssignment,'80C-1');
  assert.equal(valid.assignments[0]?.cruiserDistrict,'9010');

  const missingDistrict=parseRosterRows([
    headers,
    ['Class 27-A','Officer Example','0071','Trainer Example','0020','03/09/2027','DMW','Sunday;Monday;Tuesday','1','1','','80C-2'],
  ]);
  assert.ok(missingDistrict.errors.some(error=>error.includes('Cruiser District is required')));

  const wrongShiftDistrict=parseRosterRows([
    headers,
    ['Class 27-A','Officer Example','0071','Trainer Example','0020','03/09/2027','DMW','Sunday;Monday;Tuesday','1','1','10','80C-2'],
  ]);
  assert.ok(wrongShiftDistrict.errors.some(error=>error.includes('mapped cruiser district, and shift')));
});

test('dates are displayed and accepted only as MM/DD/YYYY',()=>{
  assert.equal(formatDateMDY('2027-03-09'),'03/09/2027');
  assert.equal(parseDateMDY('03/09/2027'),'2027-03-09');
  assert.equal(parseDateMDY('2027-03-09'),undefined);
  assert.equal(parseDateMDY('13/03/2027'),undefined);
});
