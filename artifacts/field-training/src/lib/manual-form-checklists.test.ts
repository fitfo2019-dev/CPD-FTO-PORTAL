import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_DUTY_CHECKLIST,
  defaultDirectiveReviewRecord,
  newRunChecklist,
  RUN_CHECKLIST_ITEMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_ITEMS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
} from './model.js';
import { SUBSTATION_ORIENTATION_KEYS, SUBSTATION_ORIENTATION_SECTIONS, defaultSubstationOrientationChecklist } from './substation-orientation.js';

const submittedPrimaryCounts = {
  call_for_service: 52,
  self_initiated: 52,
  domestic_incident: 63,
  traffic_crash: 52,
  traffic_stop: 68,
  high_risk_stop: 60,
  building_search: 71,
} as const;
const submittedSupplementCounts = { arrest_process: 62, ovi_process: 63, narrative_addition: 0 } as const;

test('run form checklists keep one checkbox for every submitted form item', () => {
  for (const [form, expected] of Object.entries(submittedPrimaryCounts)) {
    assert.equal(RUN_CHECKLIST_ITEMS[form as keyof typeof RUN_CHECKLIST_ITEMS].length, expected, form);
    assert.equal(
      RUN_CHECKLIST_SECTIONS[form as keyof typeof RUN_CHECKLIST_SECTIONS].reduce((count, group) => count + group.items.length, 0),
      expected,
      `${form} grouping must not hide or combine checkbox items`,
    );
  }
  for (const [form, expected] of Object.entries(submittedSupplementCounts)) {
    assert.equal(RUN_SUPPLEMENT_CHECKLIST_ITEMS[form as keyof typeof RUN_SUPPLEMENT_CHECKLIST_ITEMS].length, expected, form);
    assert.equal(
      RUN_SUPPLEMENT_CHECKLIST_SECTIONS[form as keyof typeof RUN_SUPPLEMENT_CHECKLIST_SECTIONS].reduce((count, group) => count + group.items.length, 0),
      expected,
      `${form} supplemental checklist count`,
    );
  }
});

test('all submitted run checkboxes and the three checklists start checked', () => {
  for (const form of Object.keys(submittedPrimaryCounts) as (keyof typeof RUN_CHECKLIST_ITEMS)[]) {
    const checklist = newRunChecklist(form);
    assert.ok(RUN_CHECKLIST_ITEMS[form].every((_, index) => checklist[`task-${index}`] === true), form);
    assert.equal(checklist['na-task'], false);
  }
  for (const form of ['arrest_process', 'ovi_process'] as const) {
    const checklist = newRunChecklist('call_for_service', [form]);
    assert.ok(RUN_SUPPLEMENT_CHECKLIST_ITEMS[form].every((_, index) => checklist[`supp-${form}-${index}`] === true), form);
    assert.equal(checklist[`na-supp-${form}`], false);
  }
  assert.ok(DAILY_DUTY_CHECKLIST.flatMap(group => group.items).length === 33);
  assert.ok(SUBSTATION_ORIENTATION_KEYS.length === 82);
  assert.ok(SUBSTATION_ORIENTATION_SECTIONS.flatMap(group => group.items).every(([key]) => defaultSubstationOrientationChecklist()[key]));
});

test('daily duty wording and one/two-officer checkboxes match the submitted form', () => {
  const items = DAILY_DUTY_CHECKLIST.flatMap(group => group.items);
  assert.ok(items.some(item => item.label === 'Worked as a one officer unit'));
  assert.ok(items.some(item => item.label === 'Worked as a two officer unit'));
  assert.ok(items.some(item => item.label === 'Conducted inspection of cruiser (cleanliness, damage, weapons, contraband, equipment, etc.)'));
  assert.ok(items.some(item => item.label === 'Returned assigned equipment to substation (unloaded shotgun, keys, Taser, etc)'));
  assert.ok(RUN_CHECKLIST_ITEMS.high_risk_stop.includes('Other:'));
  for (const form of [...Object.keys(submittedPrimaryCounts), 'arrest_process', 'ovi_process'] as (keyof typeof RUN_CHECKLIST_ITEMS | keyof typeof RUN_SUPPLEMENT_CHECKLIST_ITEMS)[]) {
    const allItems = form in RUN_CHECKLIST_ITEMS
      ? RUN_CHECKLIST_ITEMS[form as keyof typeof RUN_CHECKLIST_ITEMS]
      : RUN_SUPPLEMENT_CHECKLIST_ITEMS[form as keyof typeof RUN_SUPPLEMENT_CHECKLIST_ITEMS];
    assert.ok(allItems.includes('Review of Division Directives, SOP, etc. (list)'), String(form));
  }
  assert.deepEqual(defaultDirectiveReviewRecord(),{
    divisionDirectives:true,selectedDirectives:[],directiveDetails:'',ohioRevisedCode:true,selectedOrcReferences:[],columbusCityCode:true,selectedColumbusCodeReferences:[],other:true,otherDetails:'',
  });
});
