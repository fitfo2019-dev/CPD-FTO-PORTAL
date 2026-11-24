import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  CPD_GEOGRAPHY, PatrolAssignmentMetadataSchema, TACTICAL_CALL_SIGNS,
  cruiserDistrictForFtoAssignment, ftoAssignmentsForPrecinct, isValidAssignment,
} from './cpd-geography.js';
import { parseRosterFile, parseRosterRows } from './assignment-import.js';
import { assertTacticalAssignmentMetadata } from './assignment-metadata.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { validateReportsForExport } from './export-validation.js';
import { seedReports } from './seed.js';

const area={zone:'3',precinct:'15',cruiserDistrict:'153',shift:'C-Co' as const};
const headers=['Class','PO Name','PO Badge','FTO Name','FTO Badge','Start Date','Shift','Zone','Precinct','Cruiser District','Call Sign'];
const roster=(code:string,district='153',zone='3',precinct='15',shift='C-Co')=>[
  headers,['TEST ONLY','Example PO','TEST-1','Example FTO','TEST-2','11/22/2026',shift,zone,precinct,district,code],
];

test('all universal call-signs preserve independent Zone 3 / Precinct 15 / C / District 153 metadata',()=>{
  for(const ftoAssignment of TACTICAL_CALL_SIGNS) {
    const input={...area,ftoAssignment};
    assert.deepEqual(PatrolAssignmentMetadataSchema.parse(input),input);
    assert.equal(cruiserDistrictForFtoAssignment('3','15',ftoAssignment,'C-Co','153'),'153');
    assert.equal(cruiserDistrictForFtoAssignment('3','15',ftoAssignment,'C-Co'),undefined);
    assert.ok(ftoAssignmentsForPrecinct('3','15','C-Co','153').includes(ftoAssignment));
    assert.doesNotThrow(()=>assertTacticalAssignmentMetadata(JSON.parse(JSON.stringify(input))));
    const parsed=parseRosterRows(roster(ftoAssignment));
    assert.deepEqual(parsed.errors,[]);
    assert.equal(parsed.assignments[0].ftoAssignment,ftoAssignment);
    assert.equal(parsed.assignments[0].cruiserDistrict,'153');
  }
});

test('tactical identifiers cannot infer geography or bypass precinct and shift boundaries',()=>{
  for(const rows of [
    roster('80C-1',''),roster('80C-1','153','1'),roster('80C-2','153','3','8'),
    roster('80C-1','9150'),roster('80C-2','153','3','15','DMW'),
    roster('80C-1','9150','3','15','A-Co'),roster('80C-3'),
    roster('80C1'),roster('80C-2','153','3','15','EMW'),
  ]) assert.ok(parseRosterRows(rows).errors.length>0);
  for(const rows of [
    roster('80C-1','153','3','15','A-Co'),
    roster('80C-2','9150','3','15','DMW'),
    roster('80C-1','9150','3','15','EMW'),
  ]) assert.deepEqual(parseRosterRows(rows).errors,[]);
  assert.throws(()=>assertTacticalAssignmentMetadata({...area,precinct:'8',ftoAssignment:'80C-1'}));
  assert.doesNotThrow(()=>assertTacticalAssignmentMetadata({ftoAssignment:'80C',shift:'Day'}));
  assert.throws(()=>assertTacticalAssignmentMetadata({...area,ftoAssignment:'80C',cruiserDistrict:''}));
});

test('ordinary assignments round-trip across every mapped precinct and shift',()=>{
  for(const zone of CPD_GEOGRAPHY) for(const precinct of zone.precincts) {
    for(const shift of ['A-Co','B-Co','C-Co','DMW','EMW']) {
      const assignments=ftoAssignmentsForPrecinct(zone.zone,precinct.precinct,shift)
        .filter(assignment=>!TACTICAL_CALL_SIGNS.some(code=>code===assignment));
      assert.ok(assignments.length>0);
      for(const ftoAssignment of assignments) {
        const cruiserDistrict=cruiserDistrictForFtoAssignment(zone.zone,precinct.precinct,ftoAssignment,shift);
        assert.ok(PatrolAssignmentMetadataSchema.safeParse({
          zone:zone.zone,precinct:precinct.precinct,shift,cruiserDistrict,ftoAssignment,
        }).success,`${zone.zone}/${precinct.precinct}/${shift}/${ftoAssignment}`);
      }
    }
  }
  assert.equal(isValidAssignment('3','15','153','DMW'),false);
  assert.equal(isValidAssignment('3','15','9150','C-Co'),false);
  assert.ok(parseRosterRows(roster('153C','153')).assignments.length);
  assert.deepEqual(parseRosterRows(roster('80C','153')).errors,[]);
  assert.ok(parseRosterRows(roster('80C','')).errors.length);
  assert.ok(parseRosterRows(roster('153C','80')).errors.length);
});

test('Excel imports use the same explicit hierarchy validator as CSV and Word rows',async()=>{
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(roster('80C-2')),'Roster');
  const bytes=XLSX.write(workbook,{type:'array',bookType:'xlsx'});
  const parsed=await parseRosterFile(new File([bytes],'roster.xlsx'));
  assert.deepEqual(parsed.errors,[]);
  assert.equal(parsed.assignments[0].cruiserDistrict,'153');
  assert.equal(parsed.assignments[0].ftoAssignment,'80C-2');
});

test('saved reports and real workbook cells retain tactical codes without adding columns',()=>{
  for(const ftoAssignment of TACTICAL_CALL_SIGNS) {
    const report={...seedReports()[0],...area,ftoAssignment};
    const reopened=validateReportsForExport(JSON.parse(JSON.stringify([report])));
    assert.equal(reopened[0].ftoAssignment,ftoAssignment);
    assert.equal(reopened[0].cruiserDistrict,'153');
    const workbook=buildClassWorkbook(reopened);
    const ordinary=buildClassWorkbook([{...report,ftoAssignment:'153C'}]);
    assert.deepEqual(workbook.SheetNames,ordinary.SheetNames);
    const values=workbook.SheetNames.flatMap(name=>Object.values(workbook.Sheets[name]).map(cell=>
      typeof cell==='object'&&cell!==null&&'v' in cell?String(cell.v):''));
    assert.ok(values.some(value=>value.includes(ftoAssignment)));
    for(const name of workbook.SheetNames) assert.equal(workbook.Sheets[name]['!ref'],ordinary.Sheets[name]['!ref']);
    assert.throws(()=>validateReportsForExport([{...report,precinct:'8'}]));
  }
});

test('historical ordinary 80C reports with pre-modern shifts remain exportable without reinterpretation',()=>{
  for(const shift of ['Day','Swing','Night'] as const) {
    const report={...seedReports()[0],zone:'3',precinct:'8',cruiserDistrict:'80',ftoAssignment:'80C',shift};
    const original=structuredClone(report);
    assert.doesNotThrow(()=>assertTacticalAssignmentMetadata(report));
    assert.deepEqual(validateReportsForExport([report]),[original]);
    const workbook=buildClassWorkbook([report]);
    const values=workbook.SheetNames.flatMap(name=>Object.values(workbook.Sheets[name]).map(cell=>
      typeof cell==='object'&&cell!==null&&'v' in cell?String(cell.v):''));
    assert.ok(values.some(value=>value.includes('80C')),'Class workbook retains the original code');
    assert.ok(values.some(value=>value===shift),'Class workbook retains the historical shift');
    assert.deepEqual(report,original,'Neither export path rewrites the source report');
  }
});

test('new universal assignments still require complete modern metadata in report and workbook exports',()=>{
  for(const ftoAssignment of TACTICAL_CALL_SIGNS) for(const override of [
    {cruiserDistrict:''},{zone:'2'},{precinct:'8'},{shift:'DMW' as const},
  ]) {
    const report={...seedReports()[0],...area,ftoAssignment,...override};
    assert.throws(()=>validateReportsForExport([report]),'Report export rejects invalid new universal metadata');
    assert.throws(()=>buildClassWorkbook([report]),'Workbook export rejects invalid new universal metadata');
  }
});
