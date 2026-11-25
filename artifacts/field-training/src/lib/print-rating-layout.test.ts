import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORY_GROUPS, SEG_CATEGORIES, SEG_RATING_COLUMNS } from './model.js';
import { printRatingColumns } from './print-rating-layout.js';

test('printed rating columns preserve every section and category in reading order',()=>{
  for(const groups of [CATEGORY_GROUPS,SEG_RATING_COLUMNS.flat()]) {
    const columns=printRatingColumns(groups);
    assert.equal(columns.length,2);
    assert.deepEqual(columns.flat(),groups);
    assert.deepEqual(columns.flatMap(column=>column.flatMap(group=>SEG_CATEGORIES.filter(item=>item.group===group).map(item=>item.key))),
      groups.flatMap(group=>SEG_CATEGORIES.filter(item=>item.group===group).map(item=>item.key)));
    const weight=(column:readonly string[])=>column.reduce((sum,group)=>sum+1+SEG_CATEGORIES.filter(item=>item.group===group).length,0);
    const imbalance=Math.abs(weight(columns[0])-weight(columns[1]));
    for(let cut=1;cut<groups.length;cut++)
      assert.ok(imbalance<=Math.abs(weight(groups.slice(0,cut))-weight(groups.slice(cut))));
    assert.deepEqual(printRatingColumns(groups),columns);
  }
});

test('empty and single-section layouts remain safe without inventing groups',()=>{
  assert.deepEqual(printRatingColumns([]),[[]]);
  assert.deepEqual(printRatingColumns(['Only section']),[['Only section']]);
});
