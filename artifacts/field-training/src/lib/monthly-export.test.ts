import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx-js-style';
import {
  CATEGORIES,
  emptyDailyActivitySummary,
  emptyReportingForDutyRecord,
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
  const workbook = buildMonthlyWorkbook([weekOne, weekTwo, unreviewed], '2026-11');
  assert.deepEqual(workbook.SheetNames, ['Monthly Totals']);
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
});
