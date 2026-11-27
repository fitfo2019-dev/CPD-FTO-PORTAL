import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRatings, defaultReportingForDutyRecord, emptyDailyActivitySummary, newRunChecklist, type Category, type Report, type TrainingRun } from './model.js';
import { seedReports } from './seed.js';
import { buildOperationalPacket } from './operational-state-machine.js';
import { applyUaCounting, countedUaGroups, reconcileDeficiencyRatings, SEG_TASK_DIRECTORY } from './seg-deficiencies.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { mergeReviewedUaEntries } from './weekly-performance-log.js';
import { addedUaIssueOptions, addedUaRunOptions, removeAddedDeficiency, saveAddedDeficiency } from './added-deficiencies.js';
import { validateReportsForExport } from './export-validation.js';
import { adviseNrt } from '../features/rebuild/lib/po-progress/nrt.js';
import { uaOccurrences } from '../features/rebuild/lib/po-progress/ua-occurrences.js';

const run = (id: string, hour: number, date = '2026-11-09'): TrainingRun => ({
  id, occurredAt: `${date}T${String(hour).padStart(2, '0')}:00:00Z`, runKind: 'building_search', isDispatched: true, trafficMode: 'none',
  arrestMade: false, transportedAfterArrest: false, oviProcessed: false, narrativeAdditionRequired: false,
  formStatus: 'complete', checklistReviewedAt: '2026-11-09T20:00:00Z', narrative: 'Reviewed fictional run.',
  checklist: newRunChecklist('building_search'),
});
const failing = (id: string, hour: number, category: Category = 'buildingSearch', date = '2026-11-09') => {
  const value = run(id, hour, date);
  const key = Object.entries(SEG_TASK_DIRECTORY).find(([entry, mapped]) => entry.startsWith('building_search:') && mapped === category)?.[0];
  assert.ok(key, `fixture needs a building search task for ${category}`);
  value.checklist[key.slice('building_search:'.length)] = false;
  return value;
};
const base = (runs: TrainingRun[], id = 'fictional', date = '2026-11-09'): Report => ({
  ...structuredClone(seedReports()[0]), id, date, limboDay: false, deficiencyAutomationEnabled: true,
  ratings: defaultRatings(), runs, reportingForDuty: defaultReportingForDutyRecord(), activity: emptyDailyActivitySummary(),
});
const packet = (report: Report) => buildOperationalPacket(report, { dayReference: { week: 1, day: 1 } });
const add = (report: Report, category: Category, runId: string, id: string, at: string, extra: Partial<{ sameIssueAs: string; minutes: number }> = {}) =>
  saveAddedDeficiency(report, category, { runId, whatHappened: `Observed ${id}.`, correctiveTraining: `Trained on ${id}.`, minutes: extra.minutes ?? 10, ...(extra.sameIssueAs ? { sameIssueAs: extra.sameIssueAs } : {}) }, undefined, id, at);
const settle = (report: Report) => ({ ...reconcileDeficiencyRatings(report, packet(report)), ratingsReviewedAt: '2026-11-09T21:00:00Z' });
const log = (report: Report) => ({ id: 'week', weekStart: '2026-11-08', weekEnd: '2026-11-14', weekNumber: 1, phase: report.phase, className: report.className ?? '',
  recruitName: report.recruitName, recruitBadge: report.recruitBadge, ftoName: report.ftoName, ftoBadge: report.ftoBadge, entries: [], updatedAt: report.updatedAt });

test('an added UA is tied to a run, sets the category to UA, counts once and reaches the Weekly Performance Log', () => {
  const report = settle(add(base([run('a', 13)]), 'contentAccuracy', 'a', 'added-1', '2026-11-09T14:00:00Z', { minutes: 20 }));
  assert.equal(report.ratings.contentAccuracy.rating, 'UA');
  assert.equal(weeklyRatingCount([report], 'contentAccuracy', 'UA'), 1);
  assert.equal(weeklyRatingCount([report], 'contentAccuracy', 'A'), 0);
  const entry = mergeReviewedUaEntries(log(report), [report], []).entries.find(item => item.category === 'contentAccuracy');
  assert.ok(entry);
  assert.deepEqual(entry.sourceReferences, ['W1D1P2']);
  assert.equal(entry.totalTime, '20 min');
  assert.equal(entry.narrative, 'Observed added-1.\n\nCorrective training: Trained on added-1.');
  assert.equal(entry.notCounted, undefined);
  assert.throws(() => add(base([run('a', 13)]), 'contentAccuracy', 'missing', 'x', 'now'), /linked to a run/);
  assert.throws(() => saveAddedDeficiency(base([run('a', 13)]), 'contentAccuracy', { runId: 'a', whatHappened: ' ', correctiveTraining: 'x', minutes: 5 }, undefined, 'x', 'now'), /what happened/);
  assert.throws(() => saveAddedDeficiency(base([run('a', 13)]), 'contentAccuracy', { runId: 'a', whatHappened: 'x', correctiveTraining: 'x', minutes: 0 }, undefined, 'x', 'now'), /minutes/);
});

test('same run and category: the checklist UA counts first; added UA is documented only and still listed', () => {
  const report = settle(add(base([failing('a', 13, 'communicationsUsage')]), 'communicationsUsage', 'a', 'added-1', '2026-11-09T14:00:00Z'));
  const groups = report.checklistDeficiencies!.filter(group => group.category === 'communicationsUsage');
  assert.deepEqual(groups.map(group => [!!group.addedId, group.notCounted]), [[false, undefined], [true, 'same_run']]);
  assert.equal(weeklyRatingCount([report], 'communicationsUsage', 'UA'), 1);
  const entries = mergeReviewedUaEntries(log(report), [report], []).entries.filter(item => item.category === 'communicationsUsage');
  assert.deepEqual(entries.map(item => [item.sourceReferences, item.notCounted]), [[['W1D1P2'], undefined], [['W1D1P2'], 'same_run']]);
});

test('two added UA\'s on one run count once in the order entered; on separate runs both count', () => {
  const twoOnOne = settle(add(add(base([run('a', 13)]), 'contentAccuracy', 'a', 'later', '2026-11-09T15:00:00Z'), 'contentAccuracy', 'a', 'earlier', '2026-11-09T14:00:00Z'));
  assert.deepEqual(twoOnOne.checklistDeficiencies!.map(group => [group.addedId, group.notCounted]), [['later', 'same_run'], ['earlier', undefined]]);
  assert.equal(weeklyRatingCount([twoOnOne], 'contentAccuracy', 'UA'), 1);
  const separate = settle(add(add(base([run('a', 13), run('b', 16)]), 'contentAccuracy', 'a', 'one', 't1'), 'contentAccuracy', 'b', 'two', 't2'));
  assert.equal(weeklyRatingCount([separate], 'contentAccuracy', 'UA'), 2);
});

test('Officer Safety counts once per category per day on the first run by page, checklist or added', () => {
  const laterAdded = settle(add(base([failing('a', 13), run('b', 16)]), 'buildingSearch', 'b', 'added-b', 't1'));
  assert.deepEqual(laterAdded.checklistDeficiencies!.map(group => [group.runId, group.notCounted]), [['a', undefined], ['b', 'officer_safety_day']]);
  assert.equal(weeklyRatingCount([laterAdded], 'buildingSearch', 'UA'), 1);
  const earlierAdded = settle(add(base([run('a', 13), failing('b', 16)]), 'buildingSearch', 'a', 'added-a', 't1'));
  const byRun = Object.fromEntries(earlierAdded.checklistDeficiencies!.map(group => [group.runId, group.notCounted]));
  assert.deepEqual(byRun, { a: undefined, b: 'officer_safety_day' });
  const entries = mergeReviewedUaEntries(log(earlierAdded), [earlierAdded], []).entries.filter(item => item.category === 'buildingSearch');
  assert.deepEqual(entries.map(item => item.notCounted).sort(), ['officer_safety_day', undefined].sort());
});

test('saved records are recalculated from their stored groups under the current rules', () => {
  const stored = settle(base([failing('a', 13), failing('b', 16)]));
  const legacy: Report = { ...stored, checklistDeficiencies: stored.checklistDeficiencies!.map(({ notCounted: _n, ...group }) => group) };
  assert.equal(legacy.checklistDeficiencies!.length, 2);
  assert.equal(countedUaGroups(legacy).length, 1);
  assert.equal(weeklyRatingCount([legacy], 'buildingSearch', 'UA'), 1);
  assert.deepEqual(applyUaCounting(legacy.checklistDeficiencies!, legacy).map(group => group.notCounted), [undefined, 'officer_safety_day']);
});

test('editing and removal stay in draft; removal clears links and an Officer Safety lock with no other source', () => {
  const draft = settle(add(base([run('a', 13)]), 'buildingSearch', 'a', 'added-1', 't1'));
  assert.ok(draft.deficiencySafetyLocks?.includes('buildingSearch'));
  const edited = saveAddedDeficiency(draft, 'buildingSearch', { runId: 'a', whatHappened: 'Changed.', correctiveTraining: 'Retrained.', minutes: 5 }, 'added-1', 'ignored', 't9');
  assert.equal(edited.addedDeficiencies?.length, 1);
  assert.equal(edited.addedDeficiencies?.[0].createdAt, 't1');
  assert.equal(edited.ratingsReviewedAt, undefined);
  const removed = reconcileDeficiencyRatings(removeAddedDeficiency(edited, 'added-1'), packet(edited));
  assert.equal(removed.addedDeficiencies?.length, 0);
  assert.equal(removed.deficiencySafetyLocks?.includes('buildingSearch'), false);
  assert.notEqual(removed.ratings.buildingSearch.rating, 'UA');
});

test('run choices are labeled by training-folder page; same-issue choices list earlier UA\'s for this PO and category', () => {
  const report = base([run('a', 13), run('b', 16)]);
  assert.deepEqual(addedUaRunOptions(report, packet(report)).map(option => [option.runId, option.label.split(' · ')[0]]), [['a', 'W1D1P2'], ['b', 'W1D1P3']]);
  const earlier = settle(add(base([run('x', 13)], 'earlier', '2026-11-08'), 'contentAccuracy', 'x', 'first', 't0'));
  const options = addedUaIssueOptions([earlier], report, 'contentAccuracy');
  assert.equal(options.length, 1);
  assert.match(options[0].id, /^earlier\|x:contentAccuracy:added:first$/);
  assert.equal(addedUaIssueOptions([earlier], report, 'routineDriving').length, 0);
});

test('linked added UA\'s, including documented-only ones, feed the NRT recommendation', () => {
  const day = (id: string, date: string, sameIssueAs?: string, extraChecklist = false) => {
    const runs = [extraChecklist ? failing(`${id}-run`, 13, 'communicationsUsage', date) : run(`${id}-run`, 13, date)];
    return settle(add(base(runs, id, date), 'communicationsUsage', `${id}-run`, `${id}-ua`, `${date}T14:00:00Z`, sameIssueAs ? { sameIssueAs } : {}));
  };
  const d1 = day('d1', '2026-11-09');
  const link = (report: Report) => `${report.id}|${report.checklistDeficiencies!.find(group => group.addedId)!.id}`;
  const d2 = day('d2', '2026-11-10', link(d1), true);
  assert.equal(d2.checklistDeficiencies!.find(group => group.addedId)?.notCounted, 'same_run');
  const d3 = day('d3', '2026-11-11', link(d2));
  const history = uaOccurrences([d1, d2, d3]);
  const today = history.find(item => item.id === link(d3))!;
  assert.equal(today.task, history.find(item => item.id === link(d1))!.task);
  assert.equal(adviseNrt(history, today).kind, 'nrt');
});

test('export validation accepts added UA\'s and rejects one without minutes', () => {
  const report = settle(add(base([run('a', 13)]), 'contentAccuracy', 'a', 'added-1', 't1'));
  assert.doesNotThrow(() => validateReportsForExport([report]));
  const broken = { ...report, addedDeficiencies: [{ ...report.addedDeficiencies![0], minutes: 0 }] };
  assert.throws(() => validateReportsForExport([broken]));
});
