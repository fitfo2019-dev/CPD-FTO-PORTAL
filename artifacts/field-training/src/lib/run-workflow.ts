import {
  PRIMARY_RUN_FORMS, SUPPLEMENTAL_RUN_FORMS, RUN_CHECKLIST_ITEMS,
  RUN_SUPPLEMENT_CHECKLIST_ITEMS, requiredSupplementalForms,
  type TrainingRun, type SupplementalRunForm,
} from './model.js';
import type { RunChecklistMetadata } from './run-checklist-state.js';

export type RunSheetKey = 'primary' | SupplementalRunForm;
export type RunWorkflowDraft = RunChecklistMetadata
  & Omit<Partial<TrainingRun>, 'arrestSeverity'|'arrestType'>
  & {arrestSeverity?:string;arrestType?:string};
export interface RunWorkflowStep {
  id: 'details' | RunSheetKey | 'finish';
  title: string;
  kind: 'details' | 'checklist' | 'finish';
}

/** Navigation describes a single incident, never additional activity records. */
export function getRunWorkflowSteps(run: RunWorkflowDraft): RunWorkflowStep[] {
  return [
    {id:'details',title:'Run details',kind:'details'},
    {id:'primary',title:PRIMARY_RUN_FORMS.find(form=>form.key===run.runKind)?.label??'Run checklist',kind:'checklist'},
    ...requiredSupplementalForms(run).map(id=>({
      id,title:SUPPLEMENTAL_RUN_FORMS.find(form=>form.key===id)?.label??id,kind:'checklist' as const,
    })),
    {id:'finish',title:'Narrative & save',kind:'finish'},
  ];
}

/**
 * Exact local comparison data, not an authentication signature. A review stays
 * current only while that sheet's answers and inherited incident fields match.
 * Activating an unrelated attachment does not by itself invalidate this sheet.
 */
export function runSheetReviewSnapshot(run: RunWorkflowDraft, sheet: RunSheetKey): string {
  const checklist=run.checklist??{};
  const items=sheet==='primary'?RUN_CHECKLIST_ITEMS[run.runKind]:RUN_SUPPLEMENT_CHECKLIST_ITEMS[sheet];
  const prefix=sheet==='primary'?'task-':`supp-${sheet}-`;
  const form=sheet==='primary'?run.runKind:sheet;
  return JSON.stringify({
    form,
    incidentNumber:run.incidentNumber??'', location:run.location??'', occurredAt:run.occurredAt??'',
    unitNumber:run.unitNumber??'',dispatchedAt:run.dispatchedAt??'',endedAt:run.endedAt??'',
    dispatchedCode:run.dispatchedCode??'', situationFoundCode:run.situationFoundCode??'',
    clearanceCode:run.clearanceCode??'', arrestMade:run.arrestMade,
    arrestSeverity:run.arrestSeverity??'',arrestType:run.arrestType??'',
    transportedAfterArrest:run.transportedAfterArrest, oviProcessed:run.oviProcessed,
    transportDestination:run.transportDestination??'', transportDestinationType:run.transportDestinationType??'',
    notApplicable:checklist[sheet==='primary'?'na-task':`na-supp-${sheet}`]===true,
    answers:items.map((_,index)=>checklist[`${prefix}${index}`]!==false),
    failureActions:items.map((_,index)=>run.checklistFailures?.[`${prefix}${index}`]??[]),
    directiveReview:run.directiveReviews?.[form]??null,
    ...(sheet==='narrative_addition'?{narrative:run.narrative??''}:{}),
  });
}
