import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultSubstationOrientationChecklist,
  SUBSTATION_ORIENTATION_KEYS,
  SUBSTATION_ORIENTATION_SECTIONS,
} from './substation-orientation';

test('orientation checklist keeps all manual items in clear, balanced categories', () => {
  const groupedKeys = SUBSTATION_ORIENTATION_SECTIONS.flatMap(section => section.items.map(([key]) => key));
  const firstPrintPage = SUBSTATION_ORIENTATION_SECTIONS.slice(0, 2).flatMap(section => section.items);
  const secondPrintPage = SUBSTATION_ORIENTATION_SECTIONS.slice(2).flatMap(section => section.items);

  assert.equal(new Set(groupedKeys).size, groupedKeys.length, 'an item must appear only once');
  assert.deepEqual([...groupedKeys].sort(), [...SUBSTATION_ORIENTATION_KEYS].sort());
  assert.equal(groupedKeys.length, 82, 'the full orientation checklist must remain represented');
  assert.equal(firstPrintPage.length, 43);
  assert.equal(secondPrintPage.length, 39);
  assert.ok(SUBSTATION_ORIENTATION_SECTIONS.every(section => section.description.trim().length > 0));
  assert.ok(groupedKeys.every(key => defaultSubstationOrientationChecklist()[key] === true));
});
