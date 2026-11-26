import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { emptyDailyActivitySummary, emptyReportingForDutyRecord, type PhaseCaseFolder, type Report } from './model.js';
import { buildIncentiveRows, buildIncentiveWorkbook, incentiveThreshold, scheduleFromDaysOff } from './fto-incentive.js';

const CLASS = 'TEST ONLY 135th Class';
function report(date: string, overrides: Partial<Report> = {}): Report {
  return {
    id: `r-${date}-${overrides.ftoBadge ?? 'TEST-1'}`, date, shift: 'A-Co', phase: 2, zone: '1', precinct: '1', cruiserDistrict: '18',
    className: CLASS, recruitName: 'TEST ONLY PO Avery', recruitBadge: 'TEST-4747', ftoName: 'TEST ONLY FTO Morgan', ftoBadge: 'TEST-1',
    activity: emptyDailyActivitySummary(), activityCountsIncludeRuns: true, runs: [], reportingForDuty: emptyReportingForDutyRecord(),
    ratings: {} as Report['ratings'], narrative: '', remedial: '', recruitComments: '', status: 'locked', signatures: {},
    syncStatus: 'submitted_complete', createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, ...overrides,
  };
}
function folder(badge: string, name: string, daysOff: PhaseCaseFolder['daysOff']): PhaseCaseFolder {
  return { id: `f-${badge}`, className: CLASS, recruitName: 'TEST ONLY PO Avery', recruitBadge: 'TEST-4747', ftoName: name, ftoBadge: badge,
    phase: 2, shift: 'A-Co', zone: '1', precinct: '1', cruiserDistrict: '18', daysOff, phaseStartDate: '2026-03-01', openedAt: '2026-03-01T00:00:00.000Z' } as PhaseCaseFolder;
}
const days = (n: number, start = 1) => Array.from({ length: n }, (_, i) => `2026-03-${String(start + i).padStart(2, '0')}`);

test('thresholds follow the 5x8 and 4x10 schedules, with Phase IV shorter', () => {
  assert.deepEqual(incentiveThreshold('5x8', 1), { required: 17, scheduled: 20 });
  assert.deepEqual(incentiveThreshold('5x8', 4), { required: 14, scheduled: 15 });
  assert.deepEqual(incentiveThreshold('4x10', 3), { required: 13, scheduled: 16 });
  assert.deepEqual(incentiveThreshold('4x10', 4), { required: 11, scheduled: 12 });
  assert.equal(scheduleFromDaysOff([0, 6]), '5x8');
  assert.equal(scheduleFromDaysOff([0, 5, 6]), '4x10');
});

test('assigned FTO at the threshold earns a full phase; one day short does not', () => {
  const met = buildIncentiveRows(days(17).map(d => report(d)), [folder('TEST-1', 'TEST ONLY FTO Morgan', [0, 6])], CLASS, 2);
  assert.equal(met[0].fullPhase, true);
  assert.equal(met[0].totalDays, 17);
  const short = buildIncentiveRows(days(16).map(d => report(d)), [folder('TEST-1', 'TEST ONLY FTO Morgan', [0, 6])], CLASS, 2);
  assert.equal(short[0].fullPhase, false);
});

test('drafts, other phases and other classes never count, and duplicate dates count once', () => {
  const reports = [...days(13).map(d => report(d)), report('2026-03-01', { id: 'dup' }), report('2026-03-20', { syncStatus: 'local_draft_pending' }),
    report('2026-03-21', { phase: 3 }), report('2026-03-22', { className: 'TEST ONLY 136th Class' })];
  const [row] = buildIncentiveRows(reports, [folder('TEST-1', 'TEST ONLY FTO Morgan', [0, 5, 6])], CLASS, 2);
  assert.equal(row.schedule, '4x10');
  assert.equal(row.assignedDays, 13);
  assert.equal(row.fullPhase, true);
});

test('coverage days add to the covering FTO total but never create a phase alone', () => {
  const cover = { assignmentId: 'a', regularFtoName: 'TEST ONLY FTO Morgan', regularFtoBadge: 'TEST-1', phaseStartDate: '2026-03-01' };
  const reports = [...days(15).map(d => report(d)), ...days(3, 16).map(d => report(d, { ftoBadge: 'TEST-2', ftoName: 'TEST ONLY FTO Reese', substituteCoverage: cover })),
    ...days(2, 20).map(d => report(d, { ftoBadge: 'TEST-1', substituteCoverage: { ...cover, regularFtoBadge: 'TEST-9' } }))];
  const rows = buildIncentiveRows(reports, [folder('TEST-1', 'TEST ONLY FTO Morgan', [0, 6])], CLASS, 2);
  const morgan = rows.find(r => r.ftoBadge === 'TEST-1')!;
  const reese = rows.find(r => r.ftoBadge === 'TEST-2')!;
  assert.deepEqual([morgan.assignedDays, morgan.coverageDays, morgan.totalDays, morgan.fullPhase], [15, 2, 17, true]);
  assert.deepEqual([reese.coverageDays, reese.fullPhase], [3, false]);
});

test('workbook has one phase sheet with YES and NO and neutralized formula text', () => {
  const rows = buildIncentiveRows([report('2026-03-01', { ftoName: '=HYPERLINK("x")' })], [folder('TEST-1', '=HYPERLINK("x")', [0, 6])], CLASS, 2);
  const wb = buildIncentiveWorkbook(rows, CLASS, 2);
  assert.deepEqual(wb.SheetNames, ['PHASE II']);
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['PHASE II'], { header: 1 });
  assert.equal(aoa[2][9], 'FULL PHASE');
  assert.equal(aoa[3][9], 'NO');
  assert.ok(!String(aoa[3][0]).startsWith('='));
});
