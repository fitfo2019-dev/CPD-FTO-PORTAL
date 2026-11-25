import assert from 'node:assert/strict';
import test from 'node:test';
import { RUN_CHECKLIST_SECTIONS, newRunChecklist, type TrainingRun } from './model.js';
import { seedReports } from './seed.js';
import { validateReportsForExport } from './export-validation.js';
import {
  isRunFailureActionSelectionValid,
  runFailureActionChoices,
  runChecklistFailureSummaries,
  validateRunFailureActionSpecs,
} from './run-checklist-failures.js';

const reportWithRun=(run:TrainingRun)=>{
  const report=structuredClone(seedReports()[0]);
  return {...report,runs:[run]};
};
const combinedRun=():TrainingRun=>{
  const checklist=newRunChecklist('call_for_service');
  checklist['task-17']=false;
  return {
    id:'fictional-combined-run',runKind:'call_for_service',occurredAt:'2026-11-24T13:00:00Z',
    isDispatched:true,trafficMode:'none',arrestMade:false,transportedAfterArrest:false,
    oviProcessed:false,narrativeAdditionRequired:false,formStatus:'complete',
    checklistReviewedAt:'2026-11-24T14:00:00Z',narrative:'Fictional reviewed run.',
    checklist,checklistFailures:{'task-17':['Obtained identification']},
  };
};

test('specific action mappings preserve parent checkbox labels and include only meaningful combinations',()=>{
  validateRunFailureActionSpecs();
  const labels=RUN_CHECKLIST_SECTIONS.call_for_service.flatMap(section=>section.items.map(item=>item.label));
  const label=labels[17];
  assert.equal(label,'Obtained the proper documentation, identification, information');
  const choices=runFailureActionChoices('call_for_service','task-17',label);
  assert.deepEqual(choices,['Obtained the proper documentation','Obtained identification','Gathered relevant information']);
  assert.equal(runFailureActionChoices('call_for_service','task-0',labels[0]),undefined);
  assert.equal(isRunFailureActionSelectionValid('call_for_service','task-17',label,['Obtained identification']),true);
  assert.equal(isRunFailureActionSelectionValid('call_for_service','task-17',label,[]),false);
  assert.equal(isRunFailureActionSelectionValid('call_for_service','task-17',label,['invented action']),false);
  assert.throws(()=>runFailureActionChoices('call_for_service','task-17','Changed official label'));
  const summaries=runChecklistFailureSummaries(combinedRun());
  assert.deepEqual(summaries,[{key:'task-17',label,failureActions:['Obtained identification']}]);
  const legacyRun=combinedRun();
  delete legacyRun.checklistFailures;
  assert.deepEqual(runChecklistFailureSummaries(legacyRun),[{key:'task-17',label,failureActions:[]}]);
});

test('legacy unchecked items stay valid while new details require valid choices on an unchecked item',()=>{
  const run=combinedRun();
  assert.doesNotThrow(()=>validateReportsForExport([reportWithRun(run)]));
  const reopened=validateReportsForExport(JSON.parse(JSON.stringify([reportWithRun(run)])))[0];
  assert.deepEqual(reopened.runs[0].checklistFailures,run.checklistFailures);
  const legacy={...run};
  delete legacy.checklistFailures;
  assert.doesNotThrow(()=>validateReportsForExport([reportWithRun(legacy)]));

  const invalidChoice={...run,checklistFailures:{'task-17':['An action not in the choice list']}};
  assert.throws(()=>validateReportsForExport([reportWithRun(invalidChoice)]));
  const checked={...run,checklist:{...run.checklist,'task-17':true}};
  assert.throws(()=>validateReportsForExport([reportWithRun(checked)]));
  const unknown={...run,checklistFailures:{'task-999':['Obtained identification']}};
  assert.throws(()=>validateReportsForExport([reportWithRun(unknown)]));
});

test('supplemental failure details validate only while their source form is attached',()=>{
  const run=combinedRun();
  run.arrestMade=true;
  run.checklist=newRunChecklist('call_for_service',['arrest_process']);
  run.checklist['supp-arrest_process-0']=false;
  run.checklistFailures={'supp-arrest_process-0':['Gapped the handcuffs']};
  assert.doesNotThrow(()=>validateReportsForExport([reportWithRun(run)]));
  const reopened=validateReportsForExport(JSON.parse(JSON.stringify([reportWithRun(run)])))[0];
  assert.deepEqual(reopened.runs[0].checklistFailures,run.checklistFailures);
  assert.throws(()=>validateReportsForExport([reportWithRun({...run,arrestMade:false})]));
});
