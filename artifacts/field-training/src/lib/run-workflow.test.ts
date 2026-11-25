import assert from 'node:assert/strict';
import test from 'node:test';
import {getRunWorkflowSteps,runSheetReviewSnapshot} from './run-workflow.js';
import {requiredSupplementalForms,RUN_CHECKLIST_ITEMS,RUN_SUPPLEMENT_CHECKLIST_ITEMS,type TrainingRun} from './model.js';
import {checklistForMetadata} from './run-checklist-state.js';
import {runDerivedActivityCounts,clearanceDerivedActivityCounts} from './run-activity.js';
import {buildOperationalPacket} from './operational-state-machine.js';
import {buildRunNarrativeDraft} from './run-narrative-draft.js';
import {seedReports} from './seed.js';

const run:TrainingRun={
  id:'FICTIONAL-QUICK-ADD',runKind:'call_for_service',occurredAt:'2026-11-23T14:00:00Z',
  incidentNumber:'FICTIONAL-INCIDENT',location:'Fictional test location',unitNumber:'TEST-A',
  isDispatched:true,trafficMode:'none',arrestMade:false,transportedAfterArrest:false,
  oviProcessed:false,narrativeAdditionRequired:false,formStatus:'complete',checklist:{},
  checklistReviewedAt:'2026-11-23T15:00:00Z',narrative:'Authored observation.',
};
const linked={...run,buildingSearchRequired:true,arrestProcessRequired:true,oviProcessRequired:true};

test('quick-add sheets are stable steps on one run and do not assert activity facts or duplicate totals',()=>{
  assert.deepEqual(getRunWorkflowSteps(linked).map(step=>step.id),['details','primary','building_search','arrest_process','ovi_process','finish']);
  assert.equal(linked.arrestMade,false);
  assert.equal(linked.transportedAfterArrest,false);
  assert.equal(linked.oviProcessed,false);
  assert.deepEqual(runDerivedActivityCounts([linked]),runDerivedActivityCounts([run]));
  assert.deepEqual(clearanceDerivedActivityCounts([linked]),clearanceDerivedActivityCounts([run]));
  assert.equal(linked.id,run.id);
  assert.deepEqual(requiredSupplementalForms(run),[]);
});

test('a primary Building Search is not duplicated, while legacy factual attachments still appear',()=>{
  assert.deepEqual(requiredSupplementalForms({...linked,runKind:'building_search'}),['arrest_process','ovi_process']);
  assert.deepEqual(requiredSupplementalForms({...run,arrestMade:true,oviProcessed:true}),['arrest_process','ovi_process']);
  assert.deepEqual(RUN_SUPPLEMENT_CHECKLIST_ITEMS.building_search,RUN_CHECKLIST_ITEMS.building_search);
});

test('removing and restoring an attachment preserves its saved mixed checklist',()=>{
  const previous=checklistForMetadata(linked);
  previous['supp-building_search-2']=false;
  previous['na-supp-ovi_process']=true;
  const off=checklistForMetadata(run,previous);
  const restored=checklistForMetadata(linked,off);
  assert.equal(restored['supp-building_search-2'],false);
  assert.equal(restored['na-supp-ovi_process'],true);
  assert.equal(previous['supp-building_search-2'],false);
});

test('review snapshots change for edited sheet answers or shared metadata, not unrelated quick-add selections',()=>{
  const source={...run,checklist:checklistForMetadata(linked)};
  const original=runSheetReviewSnapshot(source,'primary');
  assert.equal(runSheetReviewSnapshot({...source,oviProcessRequired:true},'primary'),original);
  assert.equal(runSheetReviewSnapshot({...source,checklist:{...source.checklist,'supp-building_search-2':false}},'primary'),original);
  assert.equal(runSheetReviewSnapshot({...source,checklistFailures:{'supp-building_search-2':['example detail']}},'primary'),original);
  assert.notEqual(runSheetReviewSnapshot({...source,checklist:{...source.checklist,'task-0':false}},'primary'),original);
  const selected={...source,checklist:{...source.checklist,'task-17':false},checklistFailures:{'task-17':['Obtained identification']}};
  assert.notEqual(runSheetReviewSnapshot({...selected,checklistFailures:{'task-17':['Gathered relevant information']}},'primary'),runSheetReviewSnapshot(selected,'primary'));
  assert.notEqual(runSheetReviewSnapshot({...source,location:'Edited location'},'primary'),original);
  assert.notEqual(runSheetReviewSnapshot({...source,unitNumber:'TEST-B'},'primary'),original);
  assert.notEqual(runSheetReviewSnapshot({...source,endedAt:'2026-11-23T15:30:00Z'},'primary'),original);
  assert.notEqual(runSheetReviewSnapshot({...source,narrative:'Edited continuation'},'narrative_addition'),runSheetReviewSnapshot(source,'narrative_addition'));
});

test('linked Building Search prints as a separately indexed sheet on the same incident and contributes reviewed evidence',()=>{
  const checklist=checklistForMetadata(linked);
  checklist['supp-building_search-0']=false;
  const packet=buildOperationalPacket({...seedReports()[0],narrative:'',remedial:'',runs:[{...linked,checklist}]},{dayReference:{week:1,day:2}});
  assert.equal(packet.pages.filter(page=>page.kind==='run').length,1);
  const page=packet.pages.find(page=>page.supplement==='building_search');
  assert.ok(page);
  assert.equal(page.runId,run.id);
  assert.ok(packet.exceptions.some(exception=>exception.reference===page.reference));
  assert.equal(new Set(packet.pages.map(page=>page.reference)).size,packet.pages.length);
  const draft=buildRunNarrativeDraft(linked.runKind,checklist,requiredSupplementalForms(linked));
  assert.ok(draft.includes('Building Search'));
  assert.equal(linked.narrative,'Authored observation.');
});
