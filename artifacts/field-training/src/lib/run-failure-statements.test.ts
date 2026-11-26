import assert from 'node:assert/strict';
import test from 'node:test';
import { newRunChecklist, RUN_CHECKLIST_ITEMS, type TrainingRun } from './model.js';
import { activeFailureStatementEdits, activeNotApplicable, defaultFailureStatement, runFailureStatements } from './run-failure-statements.js';

const base = (): Pick<TrainingRun, 'runKind'|'trafficMode'|'isDispatched'|'arrestMade'|'transportedAfterArrest'|'oviProcessed'|'narrativeAdditionRequired'|'checklist'> => ({
  runKind: 'traffic_stop', trafficMode: 'none', isDispatched: false, arrestMade: false, transportedAfterArrest: false, oviProcessed: false, narrativeAdditionRequired: false,
  checklist: newRunChecklist('traffic_stop'),
});
const indexOf = (label: string) => RUN_CHECKLIST_ITEMS.traffic_stop.findIndex(item => item.toLowerCase() === label);

test('approved sentences replace the item label; unknown items fall back to an editable sentence', () => {
  assert.equal(defaultFailureStatement('Greeting'), 'PO failed to properly greet the violator.');
  assert.equal(defaultFailureStatement('Some item'), 'PO failed to satisfactorily complete: Some item.');
});

test('items marked did not apply produce no sentence and no UA exception', () => {
  const greeting = `task-${indexOf('greeting')}`;
  const run = { ...base(), checklist: { ...base().checklist, [greeting]: false } };
  assert.equal(runFailureStatements(run).length, 1);
  const na = { ...run, checklistNotApplicable: { [greeting]: true as const } };
  assert.equal(runFailureStatements(na).length, 0);
  assert.deepEqual(activeNotApplicable(na), { [greeting]: true });
  assert.equal(activeNotApplicable({ ...na, checklist: base().checklist }), undefined);
});

test('FTO edits are kept only while the item is still failed', () => {
  const greeting = `task-${indexOf('greeting')}`;
  const run = { ...base(), checklist: { ...base().checklist, [greeting]: false }, failureStatements: { [greeting]: 'PO failed to greet the driver.' } };
  assert.equal(runFailureStatements(run)[0]?.text, 'PO failed to greet the driver.');
  assert.deepEqual(activeFailureStatementEdits(run), { [greeting]: 'PO failed to greet the driver.' });
  assert.equal(activeFailureStatementEdits({ ...run, checklist: base().checklist }), undefined);
});
