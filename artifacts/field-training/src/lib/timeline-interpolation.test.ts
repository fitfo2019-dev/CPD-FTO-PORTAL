import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyDailyActivitySummary,
  emptyRatings,
  emptyReportingForDutyRecord,
  newRunChecklist,
  RUN_CHECKLIST_ITEMS,
  type Category,
  type Report,
  type TrainingRun,
} from './model.js';
import { buildTimelineInterpolation } from './timeline-interpolation.js';

const TARGET_WEEK = '2026-11-15';

function report(
  id: string,
  date: string,
  options: Partial<Report> = {},
): Report {
  return {
    id,
    date,
    shift: 'A-Co',
    phase: 2,
    zone: '1',
    precinct: '11',
    cruiserDistrict: '1-1',
    ftoAssignment: 'A1',
    className: '135th',
    recruitName: 'Sample Officer',
    recruitBadge: '4747',
    ftoName: 'Sample FTO',
    ftoBadge: '101',
    activity: emptyDailyActivitySummary(),
    runs: [],
    reportingForDuty: emptyReportingForDutyRecord(),
    ratings: emptyRatings(),
    narrative: 'private narrative must not be copied',
    remedial: '',
    recruitComments: '',
    status: 'draft',
    signatures: {},
    createdAt: `${date}T18:00:00.000Z`,
    updatedAt: `${date}T18:00:00.000Z`,
    ...options,
  };
}

function ratedReport(
  id: string,
  date: string,
  category: Category,
  rating: 'NO' | 'A' | 'RT' | 'UA' | 'NRT',
  options: Partial<Report> = {},
): Report {
  const ratings = emptyRatings();
  ratings[category] = { ...ratings[category], rating };
  return report(id, date, { ratingsReviewedAt: `${date}T20:00:00.000Z`, ratings, ...options });
}

function run(overrides: Partial<TrainingRun> = {}): TrainingRun {
  return {
    id: 'run-1',
    occurredAt: '2026-11-16T10:00:00.000Z',
    runKind: 'traffic_stop',
    isDispatched: false,
    trafficMode: 'motor_vehicle',
    arrestMade: false,
    transportedAfterArrest: false,
    oviProcessed: false,
    narrativeAdditionRequired: false,
    formStatus: 'complete',
    checklist: newRunChecklist('traffic_stop'),
    checklistReviewedAt: '2026-11-16T11:00:00.000Z',
    narrative: 'private run narrative must not be copied',
    ...overrides,
  };
}

test('summarizes only reviewed non-Limbo ratings for the selected officer and week', () => {
  const selectedCategory: Category = 'vehicleStops';
  const inputs = [
    ratedReport('ua-record', '2026-11-16', selectedCategory, 'UA'),
    ratedReport('a-record', '2026-11-18', selectedCategory, 'A'),
    ratedReport('unreviewed', '2026-11-19', selectedCategory, 'UA', { ratingsReviewedAt: undefined }),
    ratedReport('limbo', '2026-11-20', selectedCategory, 'UA', { limboDay: true }),
    ratedReport('other-officer', '2026-11-17', selectedCategory, 'UA', { recruitBadge: '9999' }),
    ratedReport('outside-week', '2026-11-22', selectedCategory, 'UA'),
  ];

  const result = buildTimelineInterpolation(inputs, TARGET_WEEK, '4747', '135th');

  assert.match(result.text, /Acceptable marks recorded/);
  assert.match(result.text, /UA, RT, or NRT marks recorded for FTO review/);
  assert.match(result.text, /UA on 11\/16\/2026 followed by A on 11\/18\/2026/);
  assert.deepEqual(result.sourceReportIds, ['a-record', 'ua-record']);
  assert.doesNotMatch(result.text, /private narrative/);
  assert.doesNotMatch(result.text, /critical/i);
});

test('repeated UA is reported by exact category without a critical-task label', () => {
  const result = buildTimelineInterpolation([
    ratedReport('ua-one', '2026-11-16', 'threatAssessment', 'UA'),
    ratedReport('ua-two', '2026-11-19', 'threatAssessment', 'UA'),
  ], TARGET_WEEK, '4747', '135th');

  assert.match(result.text, /Repeated UA marks in the same exact category/);
  assert.match(result.text, /Threat Assessment \(UA on 11\/16\/2026, 11\/19\/2026\)/);
  assert.doesNotMatch(result.text, /critical/i);
});

test('run modules include only completed forms with checklist review', () => {
  const reviewed = report('reviewed-run-report', '2026-11-16', {
    runs: [run()],
  });
  const unreviewed = report('unreviewed-run-report', '2026-11-17', {
    runs: [run({
      id: 'unreviewed-run',
      runKind: 'building_search',
      formStatus: 'in_progress',
      checklistReviewedAt: undefined,
    })],
  });

  const result = buildTimelineInterpolation([reviewed, unreviewed], TARGET_WEEK, '4747', '135th');
  const expectedChecklist = RUN_CHECKLIST_ITEMS.traffic_stop[0];

  assert.match(result.text, /Traffic Stop \(1; 11\/16\/2026\)/);
  assert.match(result.text, new RegExp(expectedChecklist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(result.text, /Building Search/);
  assert.deepEqual(result.sourceReportIds, ['reviewed-run-report']);
});

test('returns no default text when the selected week has no reviewed evidence', () => {
  const result = buildTimelineInterpolation([
    ratedReport('draft-only', '2026-11-16', 'vehicleStops', 'UA', { ratingsReviewedAt: undefined }),
  ], TARGET_WEEK, '4747', '135th');

  assert.equal(result.text, '');
  assert.deepEqual(result.sourceReportIds, []);
});

test('reports rating frequencies as counts and not scores', () => {
  const result = buildTimelineInterpolation([
    ratedReport('first', '2026-11-16', 'vehicleStops', 'A'),
    ratedReport('second', '2026-11-18', 'vehicleStops', 'A'),
    ratedReport('third', '2026-11-20', 'vehicleStops', 'RT'),
  ], TARGET_WEEK, '4747', '135th');

  assert.match(result.text, /Reviewed rating frequencies \(counts, not scores\): A: 2; RT: 1/);
});
