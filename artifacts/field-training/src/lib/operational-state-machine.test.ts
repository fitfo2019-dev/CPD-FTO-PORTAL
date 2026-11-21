import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalPacket, invalidateOperationalReferences, reconcileOperationalReferences, resolveOperationalPacket } from './operational-state-machine.js';
import { seedReports } from './seed.js';
import { newRunChecklist, type PhaseCaseFolder, type SubstationOrientationRecord, type TrainingRun, type WeeklyPerformanceLog } from './model.js';
import { createEmptyWorkspace } from './empty-workspace.js';
import { splitNarrativeContinuation } from './narrative-continuation.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import XLSX from 'xlsx-js-style';

const makeRun = (id: string, overrides: Partial<TrainingRun> = {}): TrainingRun => ({
  id, occurredAt: '2025-01-06T12:00:00Z', runKind: 'building_search',
  isDispatched: true, trafficMode: 'none', arrestMade: false,
  transportedAfterArrest: false, oviProcessed: false, narrativeAdditionRequired: false,
  formStatus: 'complete', checklist: newRunChecklist('building_search'),
  checklistReviewedAt: '2025-01-06T14:00:00Z', narrative: '',
  ...overrides,
});
const report = { ...seedReports()[0], narrative: '', remedial: '' };
const folder: PhaseCaseFolder = {
  className: report.className, recruitName: report.recruitName, recruitBadge: report.recruitBadge,
  ftoName: report.ftoName, ftoBadge: report.ftoBadge, phase: report.phase, shift: 'A-Co',
  zone: report.zone, precinct: report.precinct, cruiserDistrict: report.cruiserDistrict,
  daysOff: [0, 6], phaseStartDate: '2025-01-05', openedAt: report.createdAt,
};
const orientation: SubstationOrientationRecord = {
  id: 'orientation', className: report.className ?? '', recruitName: report.recruitName,
  recruitBadge: report.recruitBadge, ftoName: report.ftoName, ftoBadge: report.ftoBadge,
  phase: 1, phaseStartDate: '2025-01-06', dateTime: '2025-01-06T09:00:00Z',
  substation: 'FICTIONAL TEST', checklist: {}, checklistReviewedAt: report.updatedAt,
  directivesReview: '', narrative: '', updatedAt: report.updatedAt,
};

test('packet arrays exceed 147 pages and restart at duty Page 1 for the next shift', () => {
  const first = buildOperationalPacket({
    ...report,
    runs: Array.from({ length: 180 }, (_, index) => makeRun(`run-${index}`)),
  }, { dayReference: { week: 1, day: 1 } });
  assert.equal(first.pages.length, 182);
  assert.equal(first.pages[146].reference, 'W1D1P147');
  assert.deepEqual(first.pages.map(page => page.page), Array.from({ length: 182 }, (_, index) => index + 1));
  const second = buildOperationalPacket({ ...report, id: 'day-two', date: '2025-01-07' }, { dayReference: { week: 1, day: 2 } });
  assert.equal(second.pages[0].kind, 'duty');
  assert.equal(second.pages[0].reference, 'W1D2P1');
  assert.equal(first.pages.length, 182);
  assert.ok(Object.isFrozen(first.pages));
});

test('phase-start orientation follows duty once, respecting the first scheduled day and class scope', () => {
  const first = resolveOperationalPacket(report, [folder], [orientation]);
  assert.deepEqual(first.pages.slice(0, 3).map(page => page.kind), ['duty', 'orientation', 'orientation_continuation']);
  assert.equal(first.pages[1].reference, 'W1D1P2');
  assert.equal(first.blockingIssues.length, 0);
  assert.equal(resolveOperationalPacket(report, [folder], []).blockingIssues.length, 1);
  assert.equal(resolveOperationalPacket(report, [folder], [{ ...orientation, checklistReviewedAt: undefined }]).blockingIssues.length, 1);
  assert.equal(resolveOperationalPacket(report, [folder], [{ ...orientation, className: 'Another Class' }]).orientation, undefined);
  const nextDay = resolveOperationalPacket({ ...report, date: '2025-01-07' }, [folder], [orientation]);
  assert.equal(nextDay.pages[0].reference, 'W1D2P1');
  assert.equal(nextDay.pages.some(page => page.kind === 'orientation'), false);
});

test('conditional supplements and every continuation consume their own sequential page', () => {
  const narrative = 'Preserved source text. '.repeat(500);
  const run = makeRun('run', { arrestMade: true, oviProcessed: true, narrative });
  const packet = buildOperationalPacket({ ...report, runs: [run] }, { dayReference: { week: 2, day: 3 } });
  assert.deepEqual(packet.pages.slice(0, 4).map(page => page.kind), ['duty', 'run', 'supplement', 'supplement']);
  assert.deepEqual(packet.pages.slice(2, 4).map(page => page.supplement), ['arrest_process', 'ovi_process']);
  assert.equal(packet.pages.filter(page => page.kind === 'run_continuation').length, splitNarrativeContinuation(narrative).length);
  assert.equal(new Set(packet.pages.map(page => page.reference)).size, packet.pages.length);
  assert.equal(packet.pages.at(-1)?.kind, 'daily_summary');
  assert.deepEqual(run, makeRun('run', { arrestMade: true, oviProcessed: true, narrative }));
});

test('failure coordinates point to their source form, not the final packet page', () => {
  const run = makeRun('source', {
    arrestMade: true,
    checklist: { ...newRunChecklist('building_search', ['arrest_process']), 'task-0': false, 'supp-arrest_process-0': false },
  });
  const source = { ...report, runs: [run, makeRun('later')], narrative: 'Long daily note. '.repeat(500) };
  const packet = buildOperationalPacket(source, { dayReference: { week: 3, day: 2 } });
  assert.deepEqual(packet.exceptions.map(item => item.reference), ['W3D2P2', 'W3D2P3']);
  assert.ok(packet.exceptions.every(item => item.reviewed));
  assert.deepEqual(source.ratings, report.ratings);
  const skipped = buildOperationalPacket({ ...source, runs: [{ ...run, checklist: { ...run.checklist, 'na-task': true, 'na-supp-arrest_process': true } }] });
  assert.equal(skipped.exceptions.length, 0);
});

test('chronological page order is derived without mutating saved runs or duplicating toggled supplements', () => {
  const early = makeRun('early', { occurredAt: '2025-01-06T11:00:00Z' });
  const late = makeRun('late', { occurredAt: '2025-01-06T15:00:00Z', arrestMade: true });
  const source = { ...report, runs: [late, early] };
  assert.deepEqual(buildOperationalPacket(source).pages.filter(page => page.kind === 'run').map(page => page.runId), ['early', 'late']);
  assert.deepEqual(source.runs.map(run => run.id), ['late', 'early']);
  assert.equal(buildOperationalPacket(source).pages.filter(page => page.kind === 'supplement').length, 1);
  assert.equal(buildOperationalPacket({ ...source, runs: [early, { ...late, arrestMade: false }] }).pages.filter(page => page.kind === 'supplement').length, 0);
  assert.throws(() => buildOperationalPacket({ ...source, runs: [early, early] }), /Duplicate run/);
});

test('class workbook uses the same packet coordinates and shields exception task strings', () => {
  const run = makeRun('test-run', { checklist: { ...newRunChecklist('building_search'), 'task-0': false } });
  const packet = resolveOperationalPacket({ ...report, runs: [run] }, [folder], [orientation]);
  const workbook = buildClassWorkbook([{ ...report, runs: [run] }], [], [], [orientation], [folder]);
  const pages = XLSX.utils.sheet_to_json(workbook.Sheets['Daily Page Index'], { header: 1 }) as unknown[][];
  assert.deepEqual(pages.slice(1).map(row => row[3]), packet.pages.map(page => page.reference));
  const exceptions = XLSX.utils.sheet_to_json(workbook.Sheets['Checklist Exceptions'], { header: 1 }) as unknown[][];
  assert.equal(exceptions[1][2], packet.exceptions[0].reference);
  assert.equal(exceptions[1][8], 'SEG mapping and FTO rating decision required');
});

test('changed packet sources invalidate reference review without rewriting historical text or training time', () => {
  const log: WeeklyPerformanceLog = {
    id: 'weekly', weekStart: '2025-01-05', weekEnd: '2025-01-11', weekNumber: 1,
    phase: 1, className: report.className ?? '', recruitName: report.recruitName,
    recruitBadge: report.recruitBadge, ftoName: report.ftoName, ftoBadge: report.ftoBadge,
    updatedAt: report.updatedAt,
    entries: [{
      id: 'reviewed-source', kind: 'corrective', category: 'buildingSearch',
      sourceReportIds: [report.id], sourceReferences: ['W1D1P4'],
      sourceReferenceReviewed: true, totalTime: 'FTO-entered actual time',
      narrative: 'Original FTO-authored articulation.',
    }],
  };
  const before = { ...createEmptyWorkspace(), reports: [report], weeklyPerformanceLogs: [log] };
  const unchanged = reconcileOperationalReferences(before, { ...before, role: 'po' });
  assert.equal(unchanged.weeklyPerformanceLogs, before.weeklyPerformanceLogs);
  const after = reconcileOperationalReferences(before, { ...before, reports: [{ ...report, runs: [makeRun('new')] }] });
  const entry = after.weeklyPerformanceLogs[0].entries[0];
  assert.equal(entry.sourceReferenceReviewed, false);
  assert.deepEqual(entry.sourceReferences, ['W1D1P4']);
  assert.equal(entry.totalTime, 'FTO-entered actual time');
  assert.equal(entry.narrative, 'Original FTO-authored articulation.');
  assert.equal(before.weeklyPerformanceLogs[0].entries[0].sourceReferenceReviewed, true);
  assert.equal(invalidateOperationalReferences([log], new Set(['unrelated-report']))[0], log);
  assert.equal(invalidateOperationalReferences([log])[0].entries[0].sourceReferenceReviewed, false);
});
