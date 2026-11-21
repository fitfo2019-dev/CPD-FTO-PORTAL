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
import { buildMonthlyWorkbook } from './monthly-export.js';
import { validateReportsForExport } from './export-validation.js';
import { buildClassWorkbook } from './exportWorkbook.js';

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

test('monthly workbook has exactly four dual-grid weekly tabs without leaking incident details', () => {
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
  const outsideMonth = makeReport('outside-month', {
    date: '2026-12-01',
    phaseWeek: 3,
    ratingsReviewedAt: '2026-12-01T18:00:00.000Z',
    activity: { ...emptyDailyActivitySummary(), trafficStops: 99 },
    ratings: Object.fromEntries(CATEGORIES.map(category => [category, ratingEntry('UA')])) as Report['ratings'],
  });
  const workbook = buildMonthlyWorkbook([weekOne, weekTwo, unreviewed, outsideMonth], '2026-11');
  assert.deepEqual(workbook.SheetNames, ['Week 1', 'Week 2', 'Week 3', 'Week 4']);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Week 1'], { header: 1 }) as unknown[][];
  const formUsageRows = rows.filter(row => row[0] === 'Form Usage');
  assert.equal(formUsageRows.length, 1);
  assert.equal(formUsageRows[0][1], 0);
  assert.equal(formUsageRows[0][2], 1);
  const secondRows=XLSX.utils.sheet_to_json(workbook.Sheets['Week 2'],{header:1}) as unknown[][];
  assert.equal(secondRows.find(row=>row[0]==='Form Usage')?.[4],1);
  const formUsageRow = rows.findIndex(row => row[0] === 'Form Usage');
  const sheet = workbook.Sheets['Week 1'];
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 2 })].s.border.top.style, 'thin');
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 2 })].s.alignment.horizontal, 'center');
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 2 })].s.border.top.color.rgb, 'FF000000');
  const trafficStops = rows.find(row => row[0] === 'Traffic Stops');
  assert.equal(trafficStops?.[1],2);
  assert.equal(secondRows.find(row=>row[0]==='Traffic Stops')?.[1],8);
  assert.ok(!rows.some(row => row[0] === 'Daily Log Sources'));
  for(const name of workbook.SheetNames){
    const values=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1}) as unknown[][];
    assert.equal(values.slice(7,37).filter(row=>SEG_CATEGORIES.some(category=>category.label===row[0])).length,30);
    assert.ok(values.some(row=>row[0]==='WEEKLY ACTIVITY SUMMARY'));
  }
  const runSupportText = JSON.stringify(Object.values(workbook.Sheets));
  assert.equal(runSupportText.includes('PRIVATE-INCIDENT'), false);
  assert.equal(runSupportText.includes('PRIVATE-LOCATION'), false);
  assert.equal(runSupportText.includes('PRIVATE-NARRATIVE'), false);
  for(const sheet of Object.values(workbook.Sheets))assert.equal(Object.values(sheet).some(cell=>typeof cell==='object'&&cell!==null&&'f'in cell),false);
});

test('four-tab export rejects a fifth source week instead of dropping it',()=>{
  assert.throws(()=>buildMonthlyWorkbook([
    makeReport('first',{date:'2026-11-01'}),makeReport('fifth',{date:'2026-11-29'}),
  ],'2026-11'),/more than four weekly tabs/);
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
  const sectionRow = rows.findIndex(row => row[0] === 'DUTY READINESS');
  assert.ok(sectionRow >= 0);
  const count = sheet[XLSX.utils.encode_cell({ r: sectionRow + 1, c: 2 })];
  assert.equal(count.s.border.top.style, 'thin');
  assert.equal(count.s.alignment.horizontal, 'center');
  assert.ok(rows.some(row => row[0] === 'WEEKLY ACTIVITY SUMMARY · FACTUAL COUNTS'));
  assert.ok(JSON.stringify(rows).includes("'=TEST-NAME"));
  assert.ok(JSON.stringify(rows).includes("'=TEST-ID"));
});
