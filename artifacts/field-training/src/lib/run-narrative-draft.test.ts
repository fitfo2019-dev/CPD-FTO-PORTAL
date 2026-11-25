import assert from 'node:assert/strict';
import test from 'node:test';
import { newRunChecklist, RUN_CHECKLIST_ITEMS, RUN_SUPPLEMENT_CHECKLIST_ITEMS } from './model.js';
import { buildRunNarrativeDraft } from './run-narrative-draft.js';

test('narrative outline includes only selected items from active forms', () => {
  const checklist = newRunChecklist('domestic_incident', ['arrest_process']);
  checklist['task-0'] = false;
  checklist['supp-arrest_process-1'] = false;

  const draft = buildRunNarrativeDraft('domestic_incident', checklist, ['arrest_process']);

  assert.match(draft, /System-generated checklist outline/);
  assert.match(draft, /Domestic Incident/);
  assert.match(draft, /Arrest Process/);
  assert.equal(draft.includes(RUN_CHECKLIST_ITEMS.domestic_incident[0]), false);
  assert.equal(draft.includes(RUN_SUPPLEMENT_CHECKLIST_ITEMS.arrest_process[1]), false);
});

test('not-applicable forms are omitted from the generated narrative', () => {
  const checklist = newRunChecklist('building_search', ['arrest_process']);
  checklist['na-task'] = true;
  checklist['na-supp-arrest_process'] = true;

  const draft = buildRunNarrativeDraft('building_search', checklist, ['arrest_process']);

  assert.match(draft, /No active checklist items are marked complete/);
  assert.doesNotMatch(draft, /Building Search/);
  assert.doesNotMatch(draft, /Arrest Process/);
});
