import assert from 'node:assert/strict';
import test from 'node:test';
import { newRunChecklist, RUN_CHECKLIST_ITEMS } from './model.js';
import { checklistForMetadata, toggleChecklistSection } from './run-checklist-state.js';

const metadata = {
  runKind: 'domestic_incident' as const,
  trafficMode: 'none' as const,
  isDispatched: true,
  arrestMade: true,
  transportedAfterArrest: true,
  arrestProcessRequired: false,
  oviProcessed: true,
  narrativeAdditionRequired: false,
};

test('metadata synchronization keeps exception-only defaults for active run forms', () => {
  const checklist = checklistForMetadata(metadata);

  assert.ok(RUN_CHECKLIST_ITEMS.domestic_incident.every((_, index) => checklist[`task-${index}`] === true));
  assert.equal(checklist['na-task'], false);
  assert.ok(Object.entries(checklist).filter(([key]) => key.startsWith('supp-')).every(([, checked]) => checked));
});

test('turning a supplement off retains its answers for safe reactivation', () => {
  const previous = checklistForMetadata(metadata);
  previous['supp-arrest_process-0'] = false;
  previous['supp-ovi_process-0'] = false;
  previous['task-0'] = false;

  const inactive = checklistForMetadata({
    ...metadata,
    arrestMade: false,
    transportedAfterArrest: false,
    oviProcessed: false,
  }, previous);

  assert.equal(inactive['task-0'], false);
  assert.equal(inactive['supp-arrest_process-0'], false);
  assert.equal(inactive['supp-ovi_process-0'], false);

  const reactivated = checklistForMetadata(metadata, inactive);
  assert.equal(reactivated['supp-arrest_process-0'], false);
  assert.equal(reactivated['supp-ovi_process-0'], false);
});

test('section toggle clears or restores only the selected checklist section', () => {
  const initial = newRunChecklist('building_search');
  const first = toggleChecklistSection(initial, 'task-', 0, 2, 'na-task');

  assert.equal(first.checked, false);
  assert.equal(first.checklist['task-0'], false);
  assert.equal(first.checklist['task-1'], false);
  assert.equal(first.checklist['task-2'], true);

  const second = toggleChecklistSection(first.checklist, 'task-', 0, 2, 'na-task');
  assert.equal(second.checked, true);
  assert.equal(second.checklist['task-0'], true);
  assert.equal(second.checklist['task-1'], true);
  assert.equal(second.checklist['na-task'], false);
});
