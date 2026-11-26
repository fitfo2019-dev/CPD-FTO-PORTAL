import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as XLSX from 'xlsx';
import {PRIMARY_RUN_FORMS,RUN_CHECKLIST_ITEMS,requiredSupplementalForms,type TrainingRun} from './model.js';
import {checklistForMetadata,resetPrimaryChecklist} from './run-checklist-state.js';
import {buildRunNarrativeDraft} from './run-narrative-draft.js';
import {getRunWorkflowSteps} from './run-workflow.js';
import {suggestRunTypeFromDispatchedCode} from './radio-codes.js';
import {buildClassWorkbook} from './exportWorkbook.js';
import {seedReports} from './seed.js';
import {registerPrintAssetHooks} from './print-asset-test-hooks.js';

registerPrintAssetHooks();
const {PrintableDailyForms}=await import('../components/printable-daily-forms.js');

const run:TrainingRun={
  id:'TEST-STOP',runKind:'traffic_stop',occurredAt:'2026-11-23T14:00:00Z',
  incidentNumber:'TEST-INCIDENT',location:'TEST LOCATION',unitNumber:'TEST UNIT',
  isDispatched:true,trafficMode:'motor_vehicle',arrestMade:false,transportedAfterArrest:false,
  oviProcessed:false,narrativeAdditionRequired:false,arrestProcessRequired:true,
  formStatus:'complete',checklist:{},checklistReviewedAt:'2026-11-23T15:00:00Z',
  narrative:'TEST Authored MiXeD narrative',
};
test('dispatch code 6 never makes the high-risk decision for the FTO',()=>{
  assert.deepEqual(suggestRunTypeFromDispatchedCode('6'),{
    status:'ambiguous',runKinds:['traffic_stop','high_risk_stop'],
  });
});
test('switching either stop primary resets only primary answers and retains attached work',()=>{
  for(const [from,to] of [['traffic_stop','high_risk_stop'],['high_risk_stop','traffic_stop']] as const){
    const original={...run,runKind:from,checklist:checklistForMetadata({...run,runKind:from})};
    original.checklist['task-0']=false;original.checklist['task-999']=false;
    original.checklist['supp-arrest_process-0']=false;
    const next={...original,runKind:to,checklist:resetPrimaryChecklist({...original,runKind:to},original.checklist)};
    assert.equal(next.id,original.id);assert.equal(next.narrative,original.narrative);
    assert.equal(next.incidentNumber,original.incidentNumber);assert.equal(next.location,original.location);
    assert.equal(next.unitNumber,original.unitNumber);assert.equal(next.occurredAt,original.occurredAt);
    assert.equal(next.checklist['task-0'],true);
    assert.equal(next.checklist['task-999'],undefined);
    assert.equal(next.checklist['supp-arrest_process-0'],false);
    assert.equal(original.checklist['task-0'],false); // Reset candidate never mutates the current draft.
    assert.deepEqual(requiredSupplementalForms(next),['arrest_process']);
    assert.equal(Object.keys(next.checklist).filter(key=>/^task-\d+$/.test(key)).length,RUN_CHECKLIST_ITEMS[to].length);
    const steps=getRunWorkflowSteps(next);
    assert.equal(steps.filter(step=>step.id==='primary').length,1);
    assert.equal(steps.find(step=>step.id==='primary')?.title,PRIMARY_RUN_FORMS.find(form=>form.key===to)?.label);
  }
});
test('saved stop kinds, narrative task sources, print forms and workbook rows use one selected primary',()=>{
  for(const kind of ['traffic_stop','high_risk_stop'] as const){
    const saved=JSON.parse(JSON.stringify({...run,runKind:kind,checklist:checklistForMetadata({...run,runKind:kind})})) as TrainingRun;
    assert.equal(saved.runKind,kind);assert.equal(saved.narrative,run.narrative);
    const selected=PRIMARY_RUN_FORMS.find(form=>form.key===kind)!;
    const other=PRIMARY_RUN_FORMS.find(form=>form.key===(kind==='traffic_stop'?'high_risk_stop':'traffic_stop'))!;
    const draft=buildRunNarrativeDraft(saved.runKind,saved.checklist,requiredSupplementalForms(saved));
    assert.ok(draft.includes(selected.label));
    if(kind==='traffic_stop')assert.ok(!draft.includes(other.label));
    const report={...seedReports()[0],runs:[saved]};
    const workbook=buildClassWorkbook([report]);
    const rows=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Run Forms'],{header:1});
    assert.equal(rows.length,2);assert.equal(rows[1][6],selected.label);
    const html=renderToStaticMarkup(createElement(PrintableDailyForms,{report}));
    assert.ok(html.includes(selected.label));
    if(kind==='traffic_stop')assert.ok(!html.includes(other.label));
    assert.equal(report.runs.length,1);
  }
});
