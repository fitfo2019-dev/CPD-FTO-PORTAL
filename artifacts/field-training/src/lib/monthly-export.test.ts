import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx-js-style';
import {
  CATEGORIES,
  emptyDailyActivitySummary,
  emptyReportingForDutyRecord,
  newRunChecklist,
  RUN_CHECKLIST_ITEMS,
  SEG_CATEGORIES,
  type RatingEntry,
  type Report,
} from './model.js';
import { buildPhaseWorkbook, serializePhaseWorkbook } from './monthly-export.js';
import { validateReportsForExport } from './export-validation.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { assertExportCopy } from '../../test-support/export-copy-boundaries.js';

const ratingEntry = (rating: RatingEntry['rating']): RatingEntry => ({
  rating,
  nrtWithUnacceptable: false,
  nrtPriorUnacceptableIds: [],
  nrtPriorDocumentationReviewed: false,
  nrtTrainingReviewed: false,
  nrtCoordinatorsNotified: false,
  nrtFtoSergeantNotified: false,
  justification: '',
});

function makeReport(id: string, overrides: Partial<Report> = {}): Report {
  return {
    id,
    date: '2026-11-01',
    shift: 'A-Co',
    phase: 1,
    zone: '1',
    precinct: '1',
    cruiserDistrict: '18',
    className: 'TEST ONLY — 135th Class',
    recruitName: 'TEST ONLY — Avery Example',
    recruitBadge: 'TEST-4747',
    ftoName: 'TEST ONLY — Morgan Example',
    ftoBadge: 'TEST-1222',
    activity: emptyDailyActivitySummary(),
    activityCountsIncludeRuns: true,
    runs: [],
    reportingForDuty: emptyReportingForDutyRecord(),
    ratings: Object.fromEntries(SEG_CATEGORIES.map(({ key }) => [key, ratingEntry('A')])) as Report['ratings'],
    narrative: '',
    remedial: '',
    recruitComments: '',
    status: 'draft',
    signatures: {},
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  };
}

test('phase workbook renders the phase weekly ranges without leaking incident details', () => {
  const weekOne = makeReport('week-one', {
    phaseWeek: 1,
    ratingsReviewedAt: '2026-11-01T18:00:00.000Z',
    activity: { ...emptyDailyActivitySummary(), trafficStops: 2 },
    ratings: Object.fromEntries(CATEGORIES.map(category => [
      category,
      ratingEntry(category === 'formUsage' ? 'A' : 'NO'),
    ])) as Report['ratings'],
  });
  const reviewedRunChecklist = newRunChecklist('building_search');
  reviewedRunChecklist['task-0'] = false;
  const unreviewedRunChecklist = newRunChecklist('building_search');
  weekOne.runs = [
    {
      id: '=FORMULA-RUN',
      incidentNumber: '=PRIVATE-INCIDENT',
      location: '=PRIVATE-LOCATION',
      occurredAt: '2026-11-01T18:30:00.000Z',
      runKind: 'building_search',
      isDispatched: false,
      trafficMode: 'none',
      arrestMade: true,
      transportedAfterArrest: false,
      oviProcessed: false,
      narrativeAdditionRequired: false,
      activityFlags: { patDowns: true },
      formStatus: 'complete',
      checklist: reviewedRunChecklist,
      checklistReviewedAt: '2026-11-01T19:00:00.000Z',
      narrative: '=PRIVATE-NARRATIVE',
    },
    {
      id: 'run-not-reviewed',
      occurredAt: '2026-11-01T20:30:00.000Z',
      runKind: 'building_search',
      isDispatched: false,
      trafficMode: 'none',
      arrestMade: false,
      transportedAfterArrest: false,
      oviProcessed: false,
      narrativeAdditionRequired: false,
      activityFlags: { trafficCitations: true },
      formStatus: 'in_progress',
      checklist: unreviewedRunChecklist,
      narrative: '',
    },
  ];
  const weekTwo = makeReport('week-two', {
    date: '2026-11-08',
    phaseWeek: 2,
    ratingsReviewedAt: '2026-11-08T18:00:00.000Z',
    activity: { ...emptyDailyActivitySummary(), trafficStops: 3 },
    ratings: Object.fromEntries(CATEGORIES.map(category => [
      category,
      ratingEntry(category === 'formUsage' ? 'UA' : 'NO'),
    ])) as Report['ratings'],
  });
  const unreviewed = makeReport('unreviewed', {
    date: '2026-11-09',
    phaseWeek: 2,
    ratingsReviewedAt: undefined,
    activity: { ...emptyDailyActivitySummary(), trafficStops: 5 },
  });
  const otherPhase = makeReport('other-phase', {
    date: '2026-12-01',
    phase: 2,
    phaseWeek: 1,
    ratingsReviewedAt: '2026-12-01T18:00:00.000Z',
    activity: { ...emptyDailyActivitySummary(), trafficStops: 99 },
    ratings: Object.fromEntries(CATEGORIES.map(category => [category, ratingEntry('UA')])) as Report['ratings'],
  });
  const approvedFourWeeks=[
    {startDate:'2026-11-01',endDate:'2026-11-07'},
    {startDate:'2026-11-08',endDate:'2026-11-14'},
    {startDate:'2026-11-15',endDate:'2026-11-21'},
    {startDate:'2026-11-22',endDate:'2026-11-28'},
  ];
  const workbook = buildPhaseWorkbook([weekOne, weekTwo, unreviewed, otherPhase], 1, {phaseStartDate:'2026-11-01',phaseWeekRanges:approvedFourWeeks});
  assert.deepEqual(workbook.SheetNames, ['Week 1', 'Week 2', 'Week 3', 'Week 4']);
  for(const name of workbook.SheetNames){
    const content=(XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1}) as unknown[][]).flat().join('\n');
    assertExportCopy(`Phase workbook ${name}`,content,[
      'Columbus Division of Police',
      'PERFORMANCE CATEGORIES',
      'DAILY ACTIVITY SUMMARY',
      'FTO Comments (Optional)',
      'Rating System:',
    ]);
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Week 1'], { header: 1 }) as unknown[][];
  const formUsageRows = rows.filter(row => row[8] === 'Form Usage');
  assert.equal(formUsageRows.length, 1);
  assert.equal(formUsageRows[0][12], 1);
  assert.equal(formUsageRows[0][14], 0);
  const secondRows=XLSX.utils.sheet_to_json(workbook.Sheets['Week 2'],{header:1}) as unknown[][];
  assert.equal(secondRows.find(row=>row[8]==='Form Usage')?.[14],1);
  const formUsageRow = rows.findIndex(row => row[8] === 'Form Usage');
  const sheet = workbook.Sheets['Week 1'];
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 13 })].s.border.top.style, 'thin');
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 13 })].s.alignment.horizontal, 'center');
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 13 })].s.border.top.color.rgb, 'FF000000');
  const trafficStops = rows.find(row => row[0] === 'Traffic Stops');
  assert.equal(trafficStops?.[5],2);
  assert.equal(secondRows.find(row=>row[0]==='Traffic Stops')?.[5],8);
  assert.ok(rows.some(row=>row[0]==='Columbus Division of Police'));
  assert.ok(rows.some(row=>row[0]==='DAILY ACTIVITY SUMMARY'));
  assert.ok(rows.some(row=>row[0]==='FTO Comments (Optional)'));
  for(const name of workbook.SheetNames){
    const values=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1}) as unknown[][];
    assert.equal(values.slice(4,21).flat().filter(value=>SEG_CATEGORIES.some(category=>category.label===value)).length,30);
    assert.ok(values.some(row=>row[0]==='DAILY ACTIVITY SUMMARY'));
  }
  assert.equal(workbook.Sheets['Week 1']!['!cols']?.length,24);
  assert.equal(workbook.Sheets['Week 1']['!pageSetup'].orientation,'landscape');
  assert.equal(workbook.Sheets['Week 1']['!pageSetup'].paperSize,1);
  const saved=serializePhaseWorkbook(workbook);
  const archive=XLSX.CFB.read(new Uint8Array(saved),{type:'array'});
  const roundTrip=XLSX.read(saved,{type:'array'});
  assert.deepEqual(roundTrip.SheetNames,workbook.SheetNames);
  workbook.SheetNames.forEach((name,index)=>{
    const xml=new TextDecoder().decode(Uint8Array.from(XLSX.CFB.find(archive,`/xl/worksheets/sheet${index+1}.xml`)!.content));
    assert.match(xml,/<pageSetup[^>]*orientation="landscape"[^>]*fitToWidth="1"[^>]*fitToHeight="1"/);
    assert.match(xml,/<pageSetUpPr fitToPage="1"/);
    assert.match(xml,/<pageSetup paperSize="1" /);
    assert.match(xml,/<pageMargins left="0\.5" right="0\.5" top="0\.5" bottom="0\.5" header="0\.1" footer="0\.1"\/>/);
    assert.match(xml,/<oddFooter>.*Template revised 11\/28\/2026<\/oddFooter>/);
    assert.deepEqual(roundTrip.Sheets[name]['!merges'],workbook.Sheets[name]['!merges']);
    assert.equal(roundTrip.Sheets[name]['!ref'],workbook.Sheets[name]['!ref']);
    for(const [address,cell] of Object.entries(workbook.Sheets[name])) {
      if(!address.startsWith('!')&&cell.v!==undefined)assert.equal(roundTrip.Sheets[name][address]?.v,cell.v);
    }
  });
  const runSupportText = JSON.stringify(Object.values(workbook.Sheets));
  assert.equal(runSupportText.includes('PRIVATE-INCIDENT'), false);
  assert.equal(runSupportText.includes('PRIVATE-LOCATION'), false);
  assert.equal(runSupportText.includes('PRIVATE-NARRATIVE'), false);
  for(const sheet of Object.values(workbook.Sheets))assert.equal(Object.values(sheet).some(cell=>typeof cell==='object'&&cell!==null&&'f'in cell),false);
});

const dateCell=(workbook:XLSX.WorkBook,name:string)=>String((XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1}) as unknown[][])[2][10]);
const trafficStopsOn=(workbook:XLSX.WorkBook,name:string)=>(XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1}) as unknown[][]).find(row=>row[0]==='Traffic Stops')?.[5];

test('a phase that crosses months stays in one workbook with every day counted',()=>{
  const reports=[
    makeReport('oct',{date:'2026-10-20',phase:2,phaseWeek:1,activity:{...emptyDailyActivitySummary(),trafficStops:2}}),
    makeReport('nov',{date:'2026-11-12',phase:2,phaseWeek:4,activity:{...emptyDailyActivitySummary(),trafficStops:7}}),
    makeReport('phase-one',{date:'2026-10-14',phase:1,phaseWeek:4,activity:{...emptyDailyActivitySummary(),trafficStops:50}}),
  ];
  const workbook=buildPhaseWorkbook(reports,2,{phaseStartDate:'2026-10-18'});
  assert.deepEqual(workbook.SheetNames,['Week 1','Week 2','Week 3','Week 4']);
  assert.equal(trafficStopsOn(workbook,'Week 1'),2);
  assert.equal(trafficStopsOn(workbook,'Week 4'),7);
  assert.match(dateCell(workbook,'Week 1'),/10\/18\/2026 – 10\/24\/2026 · Phase II$/);
  assert.match(dateCell(workbook,'Week 4'),/11\/08\/2026 – 11\/14\/2026 · Phase II$/);
});

test('without saved phase ranges the weeks anchor on the recorded phase week',()=>{
  const reports=[
    makeReport('w2',{date:'2026-11-03',phase:3,phaseWeek:2}),
    makeReport('w3',{date:'2026-11-10',phase:3,phaseWeek:3}),
  ];
  const workbook=buildPhaseWorkbook(reports,3);
  assert.deepEqual(workbook.SheetNames,['Week 1','Week 2','Week 3','Week 4']);
  assert.match(dateCell(workbook,'Week 1'),/^10\/25\/2026/);
});

test('Phase IV workbooks have three tabs',()=>{
  const workbook=buildPhaseWorkbook([makeReport('p4',{date:'2026-11-02',phase:4,phaseWeek:1})],4,{phaseStartDate:'2026-11-01'});
  assert.deepEqual(workbook.SheetNames,['Week 1','Week 2','Week 3']);
});

test('approved extra training weeks get their own Extension Week tab',()=>{
  const phaseWeekRanges=[
    {startDate:'2027-01-03',endDate:'2027-01-09'},
    {startDate:'2027-01-10',endDate:'2027-01-16'},
    {startDate:'2027-01-17',endDate:'2027-01-23'},
    {startDate:'2027-01-24',endDate:'2027-01-30'},
    {startDate:'2027-01-31',endDate:'2027-02-06'},
  ];
  const reports=[
    makeReport('week-four',{date:'2027-01-24',phase:2,activity:{...emptyDailyActivitySummary(),trafficStops:4},phaseWeek:4}),
    makeReport('extension-week',{date:'2027-01-31',phase:2,activity:{...emptyDailyActivitySummary(),trafficStops:6},phaseWeek:5}),
  ];
  const workbook=buildPhaseWorkbook(reports,2,{phaseStartDate:'2027-01-03',phaseWeekRanges});
  assert.deepEqual(workbook.SheetNames,['Week 1','Week 2','Week 3','Week 4','Week 5 (Extension Week)']);
  assert.equal(trafficStopsOn(workbook,'Week 4'),4);
  assert.equal(trafficStopsOn(workbook,'Week 5 (Extension Week)'),6);
  assert.match(dateCell(workbook,'Week 5 (Extension Week)'),/· Phase II · Extension Week$/);
  assert.doesNotMatch(dateCell(workbook,'Week 4'),/Extension/);
});

test('a limbo extension splits the long first week into separate tabs',()=>{
  const phaseWeekRanges=[
    {startDate:'2027-01-03',endDate:'2027-01-16'},
    {startDate:'2027-01-17',endDate:'2027-01-23'},
    {startDate:'2027-01-24',endDate:'2027-01-30'},
    {startDate:'2027-01-31',endDate:'2027-02-06'},
  ];
  const reports=[
    makeReport('limbo-1',{date:'2027-01-05',phase:3,phaseWeek:1,activity:{...emptyDailyActivitySummary(),trafficStops:1}}),
    makeReport('limbo-2',{date:'2027-01-12',phase:3,phaseWeek:1,activity:{...emptyDailyActivitySummary(),trafficStops:5}}),
  ];
  const workbook=buildPhaseWorkbook(reports,3,{phaseStartDate:'2027-01-03',phaseWeekRanges,limboExtensionWeeks:1});
  assert.deepEqual(workbook.SheetNames,['Week 1','Week 1 Extension 1','Week 2','Week 3','Week 4']);
  assert.equal(trafficStopsOn(workbook,'Week 1'),1);
  assert.equal(trafficStopsOn(workbook,'Week 1 Extension 1'),5);
  assert.match(dateCell(workbook,'Week 1 Extension 1'),/^01\/10\/2027 – 01\/16\/2027 · Phase III · Extension Week$/);
});

test('a saved day outside the phase ranges stops the export instead of being dropped',()=>{
  const reports=[makeReport('late',{date:'2026-12-20',phase:2,phaseWeek:4})];
  assert.throws(()=>buildPhaseWorkbook(reports,2,{phaseStartDate:'2026-11-01'}),/outside the phase's weekly ranges/);
});

test('weekly export rejects malformed or nonconsecutive source ranges',()=>{
  const report=makeReport('range-gap',{date:'2026-11-01'});
  const ranges=[
    {startDate:'2026-11-01',endDate:'2026-11-07'},
    {startDate:'2026-11-09',endDate:'2026-11-15'},
  ];
  assert.throws(()=>buildPhaseWorkbook([report],1,{phaseStartDate:'2026-11-01',phaseWeekRanges:ranges}),/gap or overlap/);
});

test('export boundary validates the exact approved categories and count types without type assertions', () => {
  const report = makeReport('validation');
  assert.equal(CATEGORIES.length, 30);
  assert.equal(Object.keys(validateReportsForExport([report])[0].ratings).length, 30);
  assert.throws(() => validateReportsForExport([{ ...report, ratings: { ...report.ratings, obsoleteCategory: ratingEntry('A') } }]));
  assert.throws(() => validateReportsForExport([{ ...report, activity: { ...report.activity, trafficStops: -1 } }]));
  assert.throws(() => validateReportsForExport([{ ...report, activity: { ...report.activity, trafficStops: '2' } }]));
  assert.throws(() => validateReportsForExport([{ ...report, ratings: {} }]));
});

test('weekly form styles survive class workbook assembly and formula-like text stays literal', () => {
  const report = makeReport('=TEST-ID', { recruitName: '=TEST-NAME', ratingsReviewedAt: '2026-11-01T18:00:00Z' });
  const workbook = buildClassWorkbook([report]);
  const name = workbook.SheetNames.find(sheet => sheet.startsWith('Weekly Summary '));
  assert.ok(name);
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const weeklyContent=rows.flat().join('\n');
  assertExportCopy(`Weekly performance workbook ${name}`,weeklyContent,[
    'PROBATIONARY OFFICER WEEKLY PERFORMANCE SUMMARY · U-10.173',
    'DEVICE-LOCAL RECORD · Not submitted or digitally signed',
    'Weekly Activity Summary · factual counts'.toLocaleUpperCase('en-US'),
    'Ratings are counts of descriptive selections, not performance scores, averages, or rankings.',
  ]);
  const sectionRow = rows.findIndex(row => row[0] === 'DUTY READINESS');
  assert.ok(sectionRow >= 0);
  const count = sheet[XLSX.utils.encode_cell({ r: sectionRow + 1, c: 2 })];
  assert.equal(count.s.border.top.style, 'thin');
  assert.equal(count.s.alignment.horizontal, 'center');
  assert.ok(rows.some(row => row[0] === 'WEEKLY ACTIVITY SUMMARY · FACTUAL COUNTS'));
  assert.ok(JSON.stringify(rows).includes("'=TEST-NAME"));
  assert.ok(JSON.stringify(rows).includes("'=TEST-ID"));
});

test('transport destinations remain visible as literal text in detailed exports',()=>{
  const report=makeReport('transport',{
    runs:[{
      id:'run-transport',occurredAt:'2026-11-01T18:30:00Z',runKind:'call_for_service',isDispatched:true,
      trafficMode:'none',arrestMade:true,transportedAfterArrest:true,transportDestination:'=FORMULA-DEST',
      oviProcessed:false,narrativeAdditionRequired:false,clearanceRulesVersion:1,arrestClassificationVersion:1,
      arrestSeverity:'Misdemeanor',arrestType:'On-view',clearanceCode:'3V',
      formStatus:'complete',checklist:newRunChecklist('call_for_service'),checklistReviewedAt:'2026-11-01T19:00:00Z',narrative:'Fictional export test.',
    }],
  });
  const sheet=buildClassWorkbook([report]).Sheets['Run Forms'];
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1}) as unknown[][];
  const headerIndex=rows.findIndex(row=>row.includes('Transport destination'));
  assert.ok(headerIndex>=0);
  const destinationIndex=rows[headerIndex].indexOf('Transport destination');
  const dataRow=rows.slice(headerIndex+1).find(row=>row[0]==='TEST ONLY — Avery Example');
  assert.ok(dataRow);
  assert.equal(dataRow[destinationIndex],"'=FORMULA-DEST");
});
