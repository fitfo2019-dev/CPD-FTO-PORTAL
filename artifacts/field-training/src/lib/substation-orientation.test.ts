import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultSubstationOrientationChecklist,
  SUBSTATION_ORIENTATION_KEYS,
  SUBSTATION_ORIENTATION_SECTIONS,
  SUBSTATION_ORIENTATION_GROUPED_SECTIONS,
  SUBSTATION_ORIENTATION_CATEGORIES,
  orientationGroupState,
  setOrientationGroup,
} from './substation-orientation.js';
import { orientationPrintLayout } from './orientation-print-layout.js';
import { ORIENTATION_NARRATIVE_LAYOUT, paginateNarrativeToPages } from './narrative-continuation.js';

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

test('every combined row has its approved descriptive category and unchanged task membership',()=>{
  const expected=[
    ['Building and Facilities',['building_orientation','locker_rooms','restrooms','break_room','vending']],
    ['Vehicle Assignment and Keys',['vehicle_status_board','cruiser_keys','relief_car']],
    ['Computer Access and Daily Information',['computer_access','daily_bulletin','division_email']],
    ['Paperwork, Mail, and Subpoenas',['paperwork_box','outgoing_mail','subpoena_book']],
    ['Citation Books',['traffic_citation_book','parking_citation_book']],
    ['Paperwork Supplies and Setup',['paperwork_supplies','briefcase_clipboard','copier_printer']],
    ['Riot Protection',['riot_helmet','riot_padding']],
    ['Rain and Traffic Gear',['rain_gear','traffic_vest']],
    ['Protective Suits',['tychem','tyvek']],
    ['Chemical Protective Accessories',['rubber_gloves','rubber_boots','chem_tape']],
    ['Manuals and Directives',['directives','complaint_manual','aid_manual']],
    ['Cruiser Video and PA Systems',['cvs','pa_system']],
    ['Cruiser Equipment Storage',['trunk_equipment','personal_equipment']],
    ['Radio Communications',['car_radio','walkie','radios','car_to_car']],
    ['Computer Systems',['computer','division_computer']],
    ['Digital Resources and Email',['internet','s_drive','powerdms','daily_email']],
    ['Records Database Access',['ohleg','leads','courtview','common_pleas']],
    ['Precinct Boundaries and Districts',['boundaries','cruiser_districts','adjacent_precincts']],
    ['Roads and Navigation',['directions','major_roads','one_way_streets']],
    ['Community Facilities and Landmarks',['cfd_stations','hospitals','landmarks','schools']],
  ];
  const rows=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.flatMap(section=>section.rows);
  assert.deepEqual(rows.filter(row=>row.keys.length>1).map(row=>[row.categoryName,[...row.keys]]),expected);
  assert.equal(new Set(rows.filter(row=>row.categoryName).map(row=>row.categoryName)).size,20);
  for(const section of SUBSTATION_ORIENTATION_GROUPED_SECTIONS) {
    const labels=new Map<string,string>(section.items);
    for(const row of section.rows) {
      assert.equal(row.id,row.keys[0],'stable row identifiers must not change');
      assert.equal(row.label,row.keys.map(key=>labels.get(key)).join('; '),'print and task wording must stay unchanged');
      if(row.keys.length===1) assert.equal(row.categoryName,undefined);
    }
  }
});

test('all rows keep legacy defaults and explicit group toggles do not alter unrelated or unknown saved values',()=>{
  const rows=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.flatMap(section=>section.rows);
  for(const row of rows) {
    assert.deepEqual(orientationGroupState({},row.keys),{checked:true,indeterminate:false});
    const saved={...defaultSubstationOrientationChecklist(),legacy_extra:false,[row.keys[0]]:false};
    const before={...saved};
    assert.deepEqual(orientationGroupState(saved,row.keys),{checked:false,indeterminate:row.keys.length>1});
    for(const value of [true,false]) {
      const next=setOrientationGroup(saved,row.keys,value);
      for(const key of Object.keys(saved)) assert.equal(next[key],row.keys.includes(key as typeof row.keys[number])?value:saved[key as keyof typeof saved]);
      assert.deepEqual(saved,before,'displaying or toggling must not mutate the saved record');
    }
  }
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
     assert.deepEqual(
       layout.continuations.filter(page=>page.label==='Additional narrative / continuation').map(page=>page.text),
       paginateNarrativeToPages(source,ORIENTATION_NARRATIVE_LAYOUT),
     );
  }
});

test('the screen places every original task in exactly one of twenty existing categories without changing print groups',()=>{
  const categories=SUBSTATION_ORIENTATION_CATEGORIES;
  assert.equal(categories.length,20);
  assert.ok(categories.every(category=>category.keys.length>1&&category.categoryName.trim().length>0));
  const keys=categories.flatMap(category=>category.keys);
  assert.equal(keys.length,82);
  assert.equal(new Set(keys).size,82);
  assert.deepEqual([...keys].sort(),[...SUBSTATION_ORIENTATION_KEYS].sort());
  const originalLabels=new Map<string,string>(SUBSTATION_ORIENTATION_SECTIONS.flatMap(section=>section.items.map(([key,label])=>[key,label] as const)));
  const printRows=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.flatMap(section=>section.rows);
  const formerSingles=printRows.filter(row=>row.keys.length===1);
  assert.equal(formerSingles.length,23,'all original independent print tasks remain intact');
  assert.equal(printRows.length,43);
  for(const category of categories) {
    assert.equal(category.id,category.keys[0]);
    assert.equal(category.label,category.keys.map(key=>originalLabels.get(key)).join('; '));
    const saved={...defaultSubstationOrientationChecklist(),[category.keys.at(-1)!]:false};
    const before={...saved};
    assert.deepEqual(orientationGroupState(saved,category.keys),{checked:false,indeterminate:true});
    const cleared=setOrientationGroup(saved,category.keys,false);
    for(const key of SUBSTATION_ORIENTATION_KEYS) assert.equal(cleared[key],category.keys.includes(key)?false:saved[key]);
    const covered=setOrientationGroup(saved,category.keys,true);
    assert.ok(category.keys.every(key=>covered[key]));
    assert.deepEqual(saved,before,'screen grouping cannot silently convert saved individual values');
  }
  const contains=(id:string,key:string)=>categories.find(category=>category.id===id)?.keys.some(item=>item===key);
  assert.ok(contains('computer_access','bwc_tower'));
  assert.ok(contains('boundaries','precinct_information'));
  assert.ok(contains('directives','review_directives_sop'));
  assert.ok(contains('car_radio','communications_failure'));
});
