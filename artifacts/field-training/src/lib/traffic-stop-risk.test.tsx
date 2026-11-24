import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import XLSX from 'xlsx-js-style';
import { TrafficStopRiskPrompt } from '../components/traffic-stop-risk-choice.js';
import { PrintableDailyForms } from '../components/printable-daily-forms.js';
import { sheetHasEdits } from '../components/run-sheet-workflow.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { resetPrimaryChecklist, checklistForMetadata } from './run-checklist-state.js';
import { newRunChecklist, RUN_CHECKLIST_ITEMS, requiredSupplementalForms, type TrainingRun } from './model.js';
import { buildRunNarrativeDraft } from './run-narrative-draft.js';
import { getRunWorkflowSteps, runSheetReviewSnapshot } from './run-workflow.js';
import { seedReports } from './seed.js';
import { suggestRunTypeFromDispatchedCode } from './radio-codes.js';

const base: TrainingRun = {
  id: 'FICTIONAL-RISK-STOP', runKind: 'traffic_stop', occurredAt: '2026-11-23T14:00:00Z',
  incidentNumber: 'FICTIONAL-INCIDENT', location: 'Fictional location', unitNumber: 'TEST-A',
  isDispatched: false, trafficMode: 'motor_vehicle', arrestMade: false, transportedAfterArrest: false,
  oviProcessed: false, buildingSearchRequired: true, narrativeAdditionRequired: false,
  formStatus: 'complete', checklistReviewedAt: '2026-11-23T15:00:00Z',
  narrative: 'Authored observation.', checklist: {},
};

test('traffic-stop choice defaults to No and reopens either saved primary without separate risk state', () => {
  for (const kind of ['traffic_stop', 'high_risk_stop'] as const) {
    const html = renderToStaticMarkup(<TrafficStopRiskPrompt open={false} onOpenChange={()=>{}} kind={kind} onChange={() => {}} testId="risk" />);
    assert.equal(html,''); // The question is not printed inline on either saved stop form.
  }
  assert.equal(renderToStaticMarkup(<TrafficStopRiskPrompt open={false} onOpenChange={()=>{}} kind="call_for_service" onChange={() => {}} testId="risk" />), '');
  assert.deepEqual(suggestRunTypeFromDispatchedCode('6'), { status: 'ambiguous', runKinds: ['traffic_stop', 'high_risk_stop'] });
});

test('switching either direction resets primary-only answers without mutating shared run work', () => {
  for (const kind of ['traffic_stop', 'high_risk_stop'] as const) {
    const source = { ...base, runKind: kind, checklist: checklistForMetadata({ ...base, runKind: kind }) };
    source.checklist['task-0'] = false;
    source.checklist['na-task'] = true;
    source.checklist['supp-building_search-2'] = false;
    const before = structuredClone(source);
    assert.equal(sheetHasEdits('primary', kind, source.checklist, {}), true);
    const next = { ...source, runKind: kind === 'traffic_stop' ? 'high_risk_stop' as const : 'traffic_stop' as const };
    next.checklist = resetPrimaryChecklist(next, source.checklist);
    assert.deepEqual(source, before);
    assert.equal(next.id, source.id);
    assert.equal(next.narrative, source.narrative);
    assert.equal(next.incidentNumber, source.incidentNumber);
    assert.equal(next.checklist['supp-building_search-2'], false);
    assert.equal(next.checklist['na-task'], false);
    assert.equal(Object.keys(next.checklist).filter(key => key.startsWith('task-')).length, RUN_CHECKLIST_ITEMS[next.runKind].length);
    assert.ok(RUN_CHECKLIST_ITEMS[next.runKind].every((_, index) => next.checklist[`task-${index}`] === true));
    assert.notEqual(runSheetReviewSnapshot(source, 'primary'), runSheetReviewSnapshot(next, 'primary'));
    assert.equal(runSheetReviewSnapshot(source, 'building_search'), runSheetReviewSnapshot(next, 'building_search'));
    assert.equal(sheetHasEdits('primary', next.runKind, next.checklist, {}), false);
  }
});

test('saved stop types use exactly their selected primary in checklist, narrative sources, print, and workbook', () => {
  for (const kind of ['traffic_stop', 'high_risk_stop'] as const) {
    const run = JSON.parse(JSON.stringify({ ...base, runKind: kind, buildingSearchRequired: false, checklist: newRunChecklist(kind) })) as TrainingRun;
    const selected = kind === 'traffic_stop' ? 'Traffic Stop' : 'High Risk Traffic Stop';
    const exclusiveTask = kind === 'traffic_stop' ? 'Recognized violation' : 'Known or suspected violent felony';
    const otherTask = kind === 'traffic_stop' ? 'Known or suspected violent felony' : 'Recognized violation';
    const report = { ...seedReports()[0], runs: [run] };
    assert.deepEqual(getRunWorkflowSteps(run).filter(step => step.kind === 'checklist').map(step => step.title), [selected]);
    const draft = buildRunNarrativeDraft(kind, run.checklist, requiredSupplementalForms(run));
    assert.ok(draft.includes(exclusiveTask));
    assert.ok(!draft.includes(otherTask));
    const html = renderToStaticMarkup(<PrintableDailyForms report={report} />);
    assert.equal((html.match(/data-testid="print-run-FICTIONAL-RISK-STOP"/g) ?? []).length, 1);
    assert.ok(html.includes(`<h1>${selected}</h1>`));
    assert.ok(html.includes(exclusiveTask));
    assert.ok(!html.includes(otherTask));
    const workbook = buildClassWorkbook([report]);
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Run Forms'], { header: 1 });
    assert.equal(rows.length, 2);
    assert.equal(rows[1][rows[0].indexOf('Primary form')], selected);
    const checklist = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Run Checklist'], { header: 1 });
    assert.ok(checklist.slice(1).every(row => row[6] === selected));
    assert.ok(checklist.some(row => row.includes(exclusiveTask)));
    assert.ok(!checklist.some(row => row.includes(otherTask)));
  }
});
