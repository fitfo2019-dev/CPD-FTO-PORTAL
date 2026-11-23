import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultSubstationOrientationChecklist,
  SUBSTATION_ORIENTATION_KEYS,
  SUBSTATION_ORIENTATION_SECTIONS,
  SUBSTATION_ORIENTATION_GROUPED_SECTIONS,
  orientationGroupState,
  setOrientationGroup,
} from './substation-orientation.js';
import { orientationPrintLayout } from './orientation-print-layout.js';

test('orientation checklist keeps all manual items in clear, balanced categories', () => {
  const groupedKeys = SUBSTATION_ORIENTATION_SECTIONS.flatMap(section => section.items.map(([key]) => key));

  assert.equal(new Set(groupedKeys).size, groupedKeys.length, 'an item must appear only once');
  assert.deepEqual([...groupedKeys].sort(), [...SUBSTATION_ORIENTATION_KEYS].sort());
  assert.equal(groupedKeys.length, 82, 'the full orientation checklist must remain represented');
  assert.ok(SUBSTATION_ORIENTATION_SECTIONS.every(section => section.description.trim().length > 0));
  assert.ok(groupedKeys.every(key => defaultSubstationOrientationChecklist()[key] === true));
});

test('approved combined rows preserve a complete unique partition of all 82 original tasks',()=>{
  const rows=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.flatMap(section=>section.rows);
  assert.equal(rows.length,43);
  const keys=rows.flatMap(row=>row.keys);
  assert.equal(keys.length,82);
  assert.equal(new Set(keys).size,82);
  assert.deepEqual([...keys].sort(),[...SUBSTATION_ORIENTATION_KEYS].sort());
  for (const key of ['taser_location','taser_log','taser_spark_test','taser_belt','shotgun_locker','clearing_barrel','gas_mask','shotgun_rack','prisoner_compartment','emergency_lights','communications_failure']) {
    assert.equal(rows.find(row=>row.keys.some(item=>item===key))?.keys.length,1,key);
  }
});

test('mixed saved task values remain mixed until an explicit group toggle without changing other tasks',()=>{
  const row=SUBSTATION_ORIENTATION_GROUPED_SECTIONS[0].rows[0];
  const saved={...defaultSubstationOrientationChecklist(),restrooms:false,taser_location:false};
  const before=JSON.stringify(saved);
  assert.deepEqual(orientationGroupState(saved,row.keys),{checked:false,indeterminate:true});
  assert.equal(JSON.stringify(saved),before);
  const covered=setOrientationGroup(saved,row.keys,true);
  assert.ok(row.keys.every(key=>covered[key]));
  assert.equal(covered.taser_location,false);
  assert.equal(saved.restrooms,false);
  const clear=setOrientationGroup(covered,row.keys,false);
  assert.deepEqual(orientationGroupState(clear,row.keys),{checked:false,indeterminate:false});
  assert.equal(clear.car_radio,true);
});

test('short notes stay on the base sheet and long or newline-heavy notes retain every character',()=>{
  assert.deepEqual(orientationPrintLayout({directivesReview:'Reviewed together.',narrative:'Revisit tomorrow.'}),{
    directives:'Reviewed together.',narrative:'Revisit tomorrow.',continuations:[],
  });
  for(const source of ['A'.repeat(10000),'\n'.repeat(100)+'END','確認済み🙂'.repeat(900),'Line one.\n\nLine three.\r\n'.repeat(90)]){
    const layout=orientationPrintLayout({directivesReview:source,narrative:source});
    assert.equal(layout.directives,'');
    assert.equal(layout.narrative,'');
    assert.equal(layout.continuations.filter(page=>page.label==='Division Directives / SOP reviewed').map(page=>page.text).join(''),source);
    assert.equal(layout.continuations.filter(page=>page.label==='Additional narrative / continuation').map(page=>page.text).join(''),source);
  }
});
