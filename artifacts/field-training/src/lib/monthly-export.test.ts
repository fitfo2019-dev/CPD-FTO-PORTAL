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
    status: 'complete',
    signatures: {},
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  };
}

test('monthly workbook lists each SEG and activity category once by program week', () => {
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
  assert.deepEqual(workbook.SheetNames, ['Monthly Totals', 'Run Support']);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Monthly Totals'], { header: 1 }) as unknown[][];
  const formUsageRows = rows.filter(row => row[0] === 'Form Usage');
  assert.equal(formUsageRows.length, 1);
  assert.equal(formUsageRows[0][1], 0);
  assert.equal(formUsageRows[0][2], 1);
  assert.equal(formUsageRows[0][9], 1);
  assert.equal(formUsageRows[0][22], 1);
  assert.equal(formUsageRows[0][24], 1);
  const formUsageRow = rows.findIndex(row => row[0] === 'Form Usage');
  assert.equal(rows[formUsageRow][11], '');
  const sheet = workbook.Sheets['Monthly Totals'];
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 2 })].s.fill.fgColor.rgb, 'FFDCFCE7');
  assert.equal(sheet[XLSX.utils.encode_cell({ r: formUsageRow, c: 9 })].s.fill.fgColor.rgb, 'FFFEE2E2');
  const trafficStops = rows.find(row => row[0] === 'Traffic Stops');
  assert.deepEqual(trafficStops, ['Traffic Stops', 2, 8, '', '', 10]);
  assert.ok(!rows.some(row => row[0] === 'Daily Log Sources'));
  assert.ok(rows.some(row => row[1] === 'Saved daily statistics only · no statistics are inferred from run forms'));

  const runSupportRows = XLSX.utils.sheet_to_json(workbook.Sheets['Run Support'], { header: 1 }) as unknown[][];
  assert.equal(runSupportRows.find(row => row[0] === 'Run records included')?.[1], 1);
  assert.equal(runSupportRows.find(row => row[0] === 'Pat Downs')?.[1], 1);
  assert.equal(runSupportRows.find(row => row[0] === 'Traffic Citations')?.[1], 0);
  assert.equal(runSupportRows.find(row => row[0] === 'Arrest Made · run metadata')?.[1], 1);
  const clearedChecklistItem = runSupportRows.find(row => row[0] === 'Building Search' && row[2] === RUN_CHECKLIST_ITEMS.building_search[0]);
  assert.equal(clearedChecklistItem?.[4], 0);
  assert.equal(clearedChecklistItem?.[6], 1);
  const runSupportText = JSON.stringify(runSupportRows);
  assert.equal(runSupportText.includes('PRIVATE-INCIDENT'), false);
  assert.equal(runSupportText.includes('PRIVATE-LOCATION'), false);
  assert.equal(runSupportText.includes('PRIVATE-NARRATIVE'), false);
  assert.equal(runSupportText.includes("'=FORMULA-RUN"), true);
  const runSupportSheet = workbook.Sheets['Run Support'];
  assert.equal(Object.values(runSupportSheet).some(cell => typeof cell === 'object' && cell !== null && 'f' in cell), false);
});
