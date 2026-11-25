import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDailyActivitySummary, emptyRatings, emptyReportingForDutyRecord, type Report } from './model.js';
import { filterReportsForMonth } from './monthly-summary.js';

function report(id: string, date: string): Report {
  return {
    id,
    date,
    shift: 'Day',
    phase: 1,
    zone: '',
    precinct: '',
    cruiserDistrict: '',
    ftoAssignment: '',
    recruitName: 'PO Example',
    recruitBadge: '1001',
    ftoName: 'FTO Example',
    ftoBadge: '2001',
    activity: emptyDailyActivitySummary(),
    activityCountsIncludeRuns: false,
    runs: [],
    reportingForDuty: emptyReportingForDutyRecord(),
    ratings: emptyRatings(),
    phaseWeek: 1,
    limboDay: false,
    narrative: '',
    remedial: '',
    recruitComments: '',
    status: 'draft',
    signatures: {},
    createdAt: '',
    updatedAt: '',
  };
}

test('monthly selector filters by the exact month and sorts source logs by date', () => {
  const reports = [report('later', '2026-11-30'), report('other-month', '2026-12-01'), report('earlier', '2026-11-02')];

  assert.deepEqual(
    filterReportsForMonth(reports, '2026-11').map(item => item.id),
    ['earlier', 'later'],
  );
});

test('monthly selector returns no source records for an invalid month key', () => {
  assert.deepEqual(filterReportsForMonth([report('one', '2026-11-02')], '2026-13'), []);
});
