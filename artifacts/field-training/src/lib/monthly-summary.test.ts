import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATEGORIES,
  emptyDailyActivitySummary,
  emptyReportingForDutyRecord,
  SEG_CATEGORIES,
  type RatingEntry,
  type Report,
} from './model';
import { summarizeMonthlyReports } from './monthly-summary';

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
    date: '2026-11-02',
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
    createdAt: '2026-11-02T12:00:00.000Z',
    updatedAt: '2026-11-02T12:00:00.000Z',
    ...overrides,
  };
}

test('monthly rollup counts only reviewed non-Limbo ratings and adds saved daily values', () => {
  const reviewed = makeReport('reviewed', {
    ratingsReviewedAt: '2026-11-02T18:00:00.000Z',
    activity: { ...emptyDailyActivitySummary(), trafficStops: 2, solveCitationSummons: 1 },
  });
  const unacceptable = makeReport('ua', {
    date: '2026-11-03',
    ratingsReviewedAt: '2026-11-03T18:00:00.000Z',
    ratings: Object.fromEntries(CATEGORIES.map(category => [
      category,
      ratingEntry(category === 'formUsage' ? 'UA' : 'A'),
    ])) as Report['ratings'],
  });
  const limbo = makeReport('limbo', { limboDay: true, ratingsReviewedAt: undefined });
  const unreviewed = makeReport('unreviewed', { ratingsReviewedAt: undefined });

  const summary = summarizeMonthlyReports([reviewed, unacceptable, limbo, unreviewed]);
  assert.equal(summary.savedLogCount, 4);
  assert.equal(summary.reviewedLogCount, 2);
  assert.equal(summary.ratingCounts.formUsage.UA, 1);
  assert.equal(summary.ratingCounts.formUsage.A, 1);
  assert.equal(summary.activityTotals.trafficStops, 2);
  assert.equal(summary.activityTotals.solveCitationSummons, 1);
});
