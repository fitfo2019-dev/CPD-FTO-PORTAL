import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultDirectiveReviewRecord } from './model.js';
import { parseReferenceEntries, reviewedTrainingMaterials } from './training-materials.js';

test('multiple training references appear as separate, labeled review rows', () => {
  const record = {
    ...defaultDirectiveReviewRecord(),
    divisionDirectives: true, ohioRevisedCode: true, columbusCityCode: true, other: true,
    selectedDirectives: ['5.07'],
    directiveDetails: '5.08 Additional directive\n5.09 Another directive',
    selectedOrcReferences: ['2903.13 — Assault', '2921.33 — Failure to comply'],
    selectedColumbusCodeReferences: ['2303.10 — Assault'],
    otherDetails: 'Patrol SOP 2.02; Training casebook topic',
  };
  const rows = reviewedTrainingMaterials(record);
  assert.equal(rows.filter(row => row.type === 'Division Directive').length, 3);
  assert.deepEqual(rows.filter(row => row.type === 'Ohio Revised Code').map(row => row.reference), record.selectedOrcReferences);
  assert.deepEqual(rows.filter(row => row.type === 'Columbus City Code').map(row => row.reference), record.selectedColumbusCodeReferences);
  assert.deepEqual(rows.filter(row => row.type === 'Other training material').map(row => row.reference), ['Patrol SOP 2.02', 'Training casebook topic']);
});

test('reference entry parsing trims values and removes duplicates', () => {
  assert.deepEqual(parseReferenceEntries('2903.13; 2903.13\n2303.10'), ['2903.13', '2303.10']);
});
