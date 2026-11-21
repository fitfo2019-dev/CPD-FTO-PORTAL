import assert from 'node:assert/strict';
import test from 'node:test';
import { sortCatalogRecords } from './library-catalog';

const records = [
  { id: 'dir-z', group: 'Division Directives', title: 'Zoning', label: 'Directive 4.01' },
  { id: 'ccc-b', group: 'Columbus City Code', title: 'Battery', label: 'CCC 1' },
  { id: 'dir-a', group: 'Division Directives', title: 'Arrests', label: 'Directive 2.01' },
  { id: 'ccc-a', group: 'Columbus City Code', title: 'Animals', label: 'CCC 2' },
];

test('catalog sorts by source group, then alphabetically by title', () => {
  assert.deepEqual(
    sortCatalogRecords(records, ['Columbus City Code', 'Division Directives']).map((record) => record.id),
    ['ccc-a', 'ccc-b', 'dir-a', 'dir-z'],
  );
});

test('catalog sort does not mutate the source list', () => {
  const originalIds = records.map((record) => record.id);
  sortCatalogRecords(records, ['Division Directives', 'Columbus City Code']);
  assert.deepEqual(records.map((record) => record.id), originalIds);
});
