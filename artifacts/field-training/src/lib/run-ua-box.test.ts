import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRatings, defaultReportingForDutyRecord, emptyDailyActivitySummary, newRunChecklist, type Category, type Report, type RunUaBox, type TrainingRun } from './model.js';
import { seedReports } from './seed.js';
import { buildOperationalPacket } from './operational-state-machine.js';
import { applyUaCounting, countedUaGroups, reconcileDeficiencyRatings, SEG_TASK_DIRECTORY } from './seg-deficiencies.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { mergeReviewedUaEntries } from './weekly-performance-log.js';
import { fullRunNarrative, normalizeUaBox, parseUaMinutes, runUaBoxGaps, runUaParagraph, uaIssueKey, uaIssueSuggestions } from './run-ua-box.js';
import { entryCategoryLabel, weeklyLogNarrativeWithReference } from './weekly-log-layout.js';
import { runFailureStatements } from './run-failure-statements.js';
import { validateReportsForExport } from './export-validation.js';
import { adviseNrt } from '../features/rebuild/lib/po-progress/nrt.js';
import { uaOccurrences } from '../features/rebuild/lib/po-progress/ua-occurrences.js';

const box = (extra: Partial<RunUaBox> = {}): RunUaBox => ({ correctiveTraining: 'Retrained on the task.', minutes: 10, ...extra });
const run = (id: string, hour: number, date = '2026-11-09', uaBox?: RunUaBox): TrainingRun => ({
  id, occurredAt: `${date}T${String(hour).padStart(2, '0')}:00:00Z`, runKind: 'building_search', isDispatched: true, trafficMode: 'none',
  arrestMade: false, transportedAfterArrest: false, oviProcessed: false, narrativeAdditionRequired: false,
  formStatus: 'complete', checklistReviewedAt: '2026-11-09T20:00:00Z', narrative: 'Reviewed fictional run.',
  checklist: newRunChecklist('building_search'), ...(uaBox ? { uaBox } : {}),
});
const taskKey = (category: Category) => {
  const key = Object.entries(SEG_TASK_DIRECTORY).find(([entry, mapped]) => entry.startsWith('building_search:') && mapped === category)?.[0];
  assert.ok(key, `fixture needs a building search task for ${category}`);
  return key.slice('building_search:'.length);
};
const failing = (id: string, hour: number, category: Category = 'buildingSearch', date = '2026-11-09', uaBox: RunUaBox | null = box()) => {
  const value = run(id, hour, date, uaBox ?? undefined);
  value.checklist[taskKey(category)] = false;
  return value;
};
const base = (runs: TrainingRun[], id = 'fictional', date = '2026-11-09'): Report => ({
  ...structuredClone(seedReports()[0]), id, date, limboDay: false, deficiencyAutomationEnabled: true,
  ratings: defaultRatings(), runs, reportingForDuty: defaultReportingForDutyRecord(), activity: emptyDailyActivitySummary(),
});
const packet = (report: Report) => buildOperationalPacket(report, { dayReference: { week: 1, day: 1 } });
const settle = (report: Report) => ({ ...reconcileDeficiencyRatings(report, packet(report)), ratingsReviewedAt: '2026-11-09T21:00:00Z' });
const log = (report: Report) => ({ id: 'week', weekStart: '2026-11-08', weekEnd: '2026-11-14', weekNumber: 1, phase: report.phase, className: report.className ?? '',
  recruitName: report.recruitName, recruitBadge: report.recruitBadge, ftoName: report.ftoName, ftoBadge: report.ftoBadge, entries: [], updatedAt: report.updatedAt });

test('a category added in the run UA box sets the rating to UA, counts once and reaches the Weekly Performance Log with its minutes', () => {
  const report = settle(base([run('a', 13, undefined, box({ addedCategories: ['contentAccuracy'], whatHappened: 'PO omitted the suspect description.', minutes: 20 }))]));
  const group = report.checklistDeficiencies!.find(item => item.category === 'contentAccuracy');
  assert.equal(group?.added, true);
  assert.equal(group?.id, 'a:contentAccuracy:added');
  assert.equal(report.ratings.contentAccuracy.rating, 'UA');
  assert.equal(weeklyRatingCount([report], 'contentAccuracy', 'UA'), 1);
  const entry = mergeReviewedUaEntries(log(report), [report], []).entries.find(item => item.category === 'contentAccuracy');
  assert.ok(entry);
  assert.equal(entry.totalTime, '20 min');
  assert.equal(entry.inlineReferences, true);
  assert.equal(entry.narrative, 'W1D1P2- PO omitted the suspect description. Retrained on the task.');
  assert.equal(weeklyLogNarrativeWithReference(entry), entry.narrative);
});

test('the run narrative is the FTO summary; the UA text follows it in checklist order', () => {
  const value = failing('a', 13, 'buildingSearch', undefined, box({ whatHappened: 'PO also entered before the cover officer arrived.' }));
  const sentences = runFailureStatements(value).map(statement => statement.text);
  assert.ok(sentences.length > 0);
  assert.equal(runUaParagraph(value), [...sentences, 'PO also entered before the cover officer arrived.', 'Retrained on the task.'].join(' '));
  assert.equal(fullRunNarrative(value), `Reviewed fictional run.\n\n${runUaParagraph(value)}`);
  assert.equal(fullRunNarrative({ ...value, uaBox: undefined, checklist: newRunChecklist('building_search') }), 'Reviewed fictional run.');
  const report = settle(base([value]));
  assert.equal(report.checklistDeficiencies![0].narrative, sentences.join(' '));
});

test('the UA box is required before ratings review only when the run has a UA', () => {
  const clean = base([run('a', 13)]);
  assert.deepEqual(runUaBoxGaps(clean.runs[0], settle(clean).checklistDeficiencies ?? []), []);
  const empty = settle(base([failing('a', 13, 'buildingSearch', undefined, null)]));
  assert.deepEqual(runUaBoxGaps(empty.runs[0], empty.checklistDeficiencies!), ['correctiveTraining', 'minutes']);
  const added = settle(base([run('a', 13, undefined, { addedCategories: ['contentAccuracy'] })]));
  assert.deepEqual(runUaBoxGaps(added.runs[0], added.checklistDeficiencies!), ['whatHappened', 'correctiveTraining', 'minutes']);
  assert.equal(parseUaMinutes('0'), undefined);
  assert.equal(parseUaMinutes('45'), 45);
  assert.equal(parseUaMinutes('4.5'), undefined);
});

test('an added category already captured by an unchecked box is dropped; empty fields are not saved', () => {
  assert.deepEqual(normalizeUaBox({ addedCategories: ['buildingSearch', 'contentAccuracy'], whatHappened: ' ', minutes: 0 }, ['buildingSearch']), { addedCategories: ['contentAccuracy'] });
  assert.equal(normalizeUaBox({ whatHappened: '' }, []), undefined);
  const report = settle(base([failing('a', 13, 'buildingSearch', undefined, box({ addedCategories: ['buildingSearch'] }))]));
  assert.equal(report.checklistDeficiencies!.filter(group => group.category === 'buildingSearch').length, 1);
});

test('FTO performed leaves the box blank with no exception, UA or sentence', () => {
  const value = failing('a', 13);
  const key = taskKey('buildingSearch');
  const performed = { ...value, checklistFtoPerformed: { [key]: true as const } };
  assert.equal(runFailureStatements(performed).length, 0);
  assert.equal(packet(base([performed])).exceptions.length, 0);
  assert.equal(settle(base([performed])).checklistDeficiencies?.length ?? 0, 0);
});

test('page 42 grouping: runs with the same categories merge into one entry; minutes are totaled; Officer Safety counts once per day', () => {
  const report = settle(base([failing('a', 13, 'buildingSearch', undefined, box({ minutes: 5 })), failing('b', 16, 'buildingSearch', undefined, box({ minutes: 15 }))]));
  assert.deepEqual(report.checklistDeficiencies!.map(group => [group.runId, group.notCounted]), [['a', undefined], ['b', 'officer_safety_day']]);
  assert.equal(weeklyRatingCount([report], 'buildingSearch', 'UA'), 1);
  const entries = mergeReviewedUaEntries(log(report), [report], []).entries.filter(item => item.autoSourceGroup);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].totalTime, '20 min');
  const [first, second] = entries[0].narrative.split('\n\n');
  assert.match(first, /^W1D1P2- PO /);
  assert.match(second, /^W1D1P3- \(Not counted: \d+ · Officer Safety, counted once per day\) PO /);
  assert.deepEqual(entries[0].sourceReferences, ['W1D1P2', 'W1D1P3']);
});

test('different category sets stay separate; a multi-category run prints its numbers in slash format', () => {
  const both = failing('a', 13, 'buildingSearch', undefined, box({ addedCategories: ['contentAccuracy'], whatHappened: 'Report omitted facts.' }));
  const report = settle(base([both, run('b', 16, undefined, box({ addedCategories: ['contentAccuracy'], whatHappened: 'Report late.' }))]));
  const entries = mergeReviewedUaEntries(log(report), [report], []).entries.filter(item => item.autoSourceGroup);
  assert.equal(entries.length, 2);
  const multi = entries.find(item => item.categories?.length === 2)!;
  assert.equal(entryCategoryLabel(multi).split('/').length, 2);
  assert.equal(entries.find(item => !item.categories)?.category, 'contentAccuracy');
});

test('the weekly merge keeps FTO edits, flags an edited entry whose source is gone, removes unedited ones, and is stable', () => {
  const report = settle(base([failing('a', 13)]));
  const first = mergeReviewedUaEntries(log(report), [report], []);
  assert.equal(mergeReviewedUaEntries(first, [report], []), first);
  const edited = { ...first, entries: first.entries.map(entry => entry.autoSourceGroup ? { ...entry, narrative: 'FTO wording.', totalTime: '25 min' } : entry) };
  const again = mergeReviewedUaEntries(edited, [report], []);
  assert.equal(again.entries.find(entry => entry.autoSourceGroup)?.narrative, 'FTO wording.');
  assert.equal(again.entries.find(entry => entry.autoSourceGroup)?.totalTime, '25 min');
  const cleared = settle({ ...report, runs: [run('a', 13)] });
  const orphan = mergeReviewedUaEntries(edited, [cleared], []).entries.find(entry => entry.autoSourceGroup);
  assert.equal(orphan?.sourceEvidenceActive, false);
  const legacy = { ...first, entries: [{ id: 'auto-deficiency-old', kind: 'corrective' as const, category: 'buildingSearch' as const, totalTime: '15 min', narrative: 'old', autoSourceNarrative: 'old', autoSourceGroup: 'a:buildingSearch', sourceReportIds: [report.id], autoGeneratedFromUa: true }] };
  assert.equal(mergeReviewedUaEntries(legacy, [report], []).entries.some(entry => entry.id === 'auto-deficiency-old'), false);
});

test('saved records are recalculated from their stored groups under the current rules', () => {
  const stored = settle(base([failing('a', 13), failing('b', 16)]));
  const legacy: Report = { ...stored, checklistDeficiencies: stored.checklistDeficiencies!.map(({ notCounted: _n, ...group }) => group) };
  assert.equal(countedUaGroups(legacy).length, 1);
  assert.deepEqual(applyUaCounting(legacy.checklistDeficiencies!, legacy).map(group => group.notCounted), [undefined, 'officer_safety_day']);
});

test('same-issue suggestions list earlier UA\'s for this PO, phase and category; the FTO link feeds the NRT recommendation', () => {
  const day = (id: string, date: string, link?: string) => settle(base([run(`${id}-run`, 13, date, box({ addedCategories: ['communicationsUsage'], whatHappened: `Radio error ${id}.`, ...(link ? { sameIssueAs: { communicationsUsage: link } } : {}) }))], id, date));
  const d1 = day('d1', '2026-11-09');
  const key = (report: Report) => uaIssueKey(report.id, report.checklistDeficiencies!.find(group => group.added)!.id);
  const probe = base([run('p-run', 13, '2026-11-10')], 'probe', '2026-11-10');
  assert.deepEqual(uaIssueSuggestions([d1], probe, 'p-run', 'communicationsUsage').map(option => option.id), [key(d1)]);
  assert.equal(uaIssueSuggestions([d1], probe, 'p-run', 'routineDriving').length, 0);
  const d2 = day('d2', '2026-11-10', key(d1));
  const d3 = day('d3', '2026-11-11', key(d2));
  const history = uaOccurrences([d1, d2, d3]);
  const today = history.find(item => item.id === key(d3))!;
  assert.equal(today.task, history.find(item => item.id === key(d1))!.task);
  assert.equal(history.find(item => item.id === key(d1))!.retrainMinutes, 10);
  assert.equal(adviseNrt(history, today).kind, 'nrt');
});

test('a run still being entered can be linked to an earlier run the same day', () => {
  const report = settle(base([run('a', 13, '2026-11-10', box({ addedCategories: ['communicationsUsage'], whatHappened: 'Radio error a.' }))], 'same-day', '2026-11-10'));
  const draftAt = run('draft', 16, '2026-11-10').occurredAt;
  const earlier = report.checklistDeficiencies!.find(group => group.added)!;
  assert.deepEqual(uaIssueSuggestions([], report, 'draft', 'communicationsUsage', draftAt).map(option => option.id), [uaIssueKey(report.id, earlier.id)]);
  assert.equal(uaIssueSuggestions([], report, 'draft', 'communicationsUsage', run('draft', 9, '2026-11-10').occurredAt).length, 0);
});

test('export validation accepts the run UA box and FTO performed marks, and rejects zero minutes', () => {
  const value = failing('a', 13);
  const report = settle(base([{ ...value, checklistFtoPerformed: { 'task-0': true } }]));
  assert.doesNotThrow(() => validateReportsForExport([report]));
  const broken = { ...report, runs: report.runs.map(item => ({ ...item, uaBox: { ...item.uaBox, minutes: 0 } })) };
  assert.throws(() => validateReportsForExport([broken]));
});

const rtDay = (id: string, date: string, text: string): Report => {
  const report = { ...base([], id, date), ratingsReviewedAt: `${date}T21:00:00Z` };
  report.ratings = { ...report.ratings, contentAccuracy: { ...report.ratings.contentAccuracy, rating: 'RT', justification: text } };
  return report;
};

test('three Responding to Training ratings in one category in a week draft a weekly log entry with no minutes', () => {
  const two = [rtDay('rt1', '2026-11-09', 'PO left out the suspect description.'), rtDay('rt2', '2026-11-10', 'PO left out the vehicle color.')];
  assert.equal(mergeReviewedUaEntries(log(two[0]!), two, []).entries.some(entry => entry.id.startsWith('auto-rt-')), false);
  const three = [...two, rtDay('rt3', '2026-11-11', 'PO left out the direction of travel.')];
  const entry = mergeReviewedUaEntries(log(three[0]!), three, []).entries.find(item => item.id === 'auto-rt-week-contentAccuracy');
  assert.ok(entry);
  assert.equal(entry.totalTime, '');
  assert.deepEqual(entry.sourceReportIds, ['rt1', 'rt2', 'rt3']);
  assert.match(entry.narrative, /suspect description[\s\S]*vehicle color[\s\S]*direction of travel/);
});

test('an FTO edit to a drafted Responding to Training entry is kept when the log is rebuilt', () => {
  const days = [rtDay('rt1', '2026-11-09', 'One.'), rtDay('rt2', '2026-11-10', 'Two.'), rtDay('rt3', '2026-11-11', 'Three.')];
  const first = mergeReviewedUaEntries(log(days[0]!), days, []);
  const edited = { ...first, entries: first.entries.map(entry => entry.id.startsWith('auto-rt-') ? { ...entry, narrative: 'FTO wording.', totalTime: '25 min' } : entry) };
  const again = mergeReviewedUaEntries(edited, days, []).entries.find(item => item.id.startsWith('auto-rt-'));
  assert.equal(again?.narrative, 'FTO wording.');
  assert.equal(again?.totalTime, '25 min');
});

test('a category marked Not Applicable counts as Not Observed', () => {
  const report = { ...base([]), ratingsReviewedAt: '2026-11-09T21:00:00Z', notApplicableCategories: ['resourceEquipmentUsage'] as Category[] };
  report.ratings = { ...report.ratings, resourceEquipmentUsage: { ...report.ratings.resourceEquipmentUsage, rating: '' } };
  assert.equal(weeklyRatingCount([report], 'resourceEquipmentUsage', 'NO'), 1);
  assert.equal(weeklyRatingCount([report], 'resourceEquipmentUsage', 'A'), 0);
});
