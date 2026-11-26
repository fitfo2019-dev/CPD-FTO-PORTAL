import React, { Fragment } from 'react';
import { REVISED_PRIMARY_CHECKLISTS, REVISED_SUPPLEMENT_CHECKLISTS, partitionRevisedChecklist, revisedRowState, rowSegments, type RevisedChecklistSection } from '@/lib/revised-run-checklists.js';
import { PrintDocument, PrintTitleBlock, PrintFieldGrid, PrintField, PrintSectionPanel, PrintChecklistRow, PrintNotesArea, PrintFooter } from '@/components/print-template.js';
import {
  DAILY_DUTY_CHECKLIST,
  DAILY_ACTIVITY_FIELDS,
  DIRECTIVE_REVIEW_LABEL,
  defaultDirectiveReviewRecord,
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  phaseAssignmentLabel,
  phaseLabel,
  requiredSupplementalForms,
  shiftDisplayLabel,
  type Report,
  type TrainingRun,
  type DirectiveReviewForm,
  type PrimaryRunForm,
} from '@/lib/model.js';
import { CLEARANCE_CODES, RADIO_CODES, SITUATION_FOUND_NA, formatRadioCode } from '@/lib/radio-codes.js';
import {
  formatDateDMY,
  formatDateTimeMDY,
  type TrainingFolderDayReference,
} from '@/lib/training-calendar.js';
import { PrintableOrientationContinuations, PrintableSubstationOrientation } from '@/components/printable-extended-forms.js';
import type { SubstationOrientationRecord } from '@/lib/model.js';
import { runFailureStatements } from '@/lib/run-failure-statements.js';
import { splitNarrativeContinuation } from '@/lib/narrative-continuation.js';
import { buildOperationalPacket, type OperationalPacket } from '@/lib/operational-state-machine.js';
import { DIVISION_DIRECTIVE_SOURCE_REVISION } from '@/lib/division-directives.js';
import { reviewedTrainingMaterials } from '@/lib/training-materials.js';
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from '@/components/printable-columbus-header.js';

function formattedRunLocation(run:TrainingRun):string {
  const cityStateZip=[run.locationCity,[run.locationState,run.locationZip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [run.location,cityStateZip].filter(Boolean).join(', ')||'Not recorded';
}
function formattedIncidentArea(run:TrainingRun):string {
  return [run.incidentZone&&`Zone ${run.incidentZone}`,run.incidentCruiserDistrict&&`Cruiser district ${run.incidentCruiserDistrict}`].filter(Boolean).join(' · ')||'Not recorded';
}

export function PrintableDailyForms({ report,orientation,dayReference,packet:providedPacket }: { report:Report;orientation?:SubstationOrientationRecord;dayReference?:TrainingFolderDayReference;packet?:OperationalPacket }) {
  const packet = providedPacket ?? buildOperationalPacket(report, { orientation, dayReference });
  const orientationReference = packet.pages.find(page => page.kind === 'orientation')?.reference;
  const orientationContinuationReferences = packet.pages.filter(page => page.kind === 'orientation_continuation').map(page => page.reference);
  const dutyPage = packet.pages.find(page => page.kind === 'duty');
  const runsById = new Map(report.runs.map(run => [run.id, run]));
  const orderedRuns = packet.pages.filter(page => page.kind === 'run').map(page => {
    const run = page.runId ? runsById.get(page.runId) : undefined;
    if (!run) throw new Error('The daily packet no longer matches its run records.');
    return run;
  });
  const runReferences = new Map<string,{primary:string|undefined;supplements:Map<string,string|undefined>;narratives:(string|undefined)[]}>();
  for (const page of packet.pages) {
    if (!page.runId) continue;
    let references = runReferences.get(page.runId);
    if (!references) {
      references = { primary: undefined, supplements: new Map(), narratives: [] };
      runReferences.set(page.runId, references);
    }
    if (page.kind === 'run') references.primary = page.reference;
    if (page.kind === 'supplement' && page.supplement) references.supplements.set(page.supplement, page.reference);
    if (page.kind === 'run_continuation') references.narratives.push(page.reference);
  }
  return <section className="print-run-packet" aria-hidden="true" data-testid="print-daily-forms">
    {orientation&&<PrintableSubstationOrientation record={orientation} pageReference={orientationReference} continuationReferences={orientationContinuationReferences} includeContinuations={false}/>}
    {dutyPage&&<DutyPage report={report} pageReference={dutyPage.reference}/>}
    {orderedRuns.map(run=>{
      const references=runReferences.get(run.id);
      return <Fragment key={run.id}>
        <RunPage report={report} run={run} pageReference={references?.primary} narrativeReferences={references?.narratives??[]}/>
        {requiredSupplementalForms(run).filter(form=>form!=='narrative_addition').map(form=><SupplementPage key={form} report={report} run={run} formKey={form} pageReference={references?.supplements.get(form)} narrativeReferences={references?.narratives??[]}/>)}
        {!!references?.narratives.length&&<NarrativeContinuationPages key={`narrative-${run.id}`} report={report} run={run} pageReferences={references.narratives}/>}
      </Fragment>;
    })}
    {orientation&&<PrintableOrientationContinuations record={orientation} pageReferences={orientationContinuationReferences}/>}
  </section>;
}

function PageHeader({ title, formNumber, report, run, subtitle, pageReference }:{title:string;formNumber:string;report:Report;run?:TrainingRun;subtitle?:string;pageReference?:string}) {
  const [runDate,runTime]=run?formatDateTimeMDY(run.occurredAt).split(' '):[];
  const options=run?partitionRevisedChecklist(REVISED_PRIMARY_CHECKLISTS[run.runKind]).headerOptions:[];
  const marker=run&&options.length>0?<span className="print-header-options">{options.map(option=><span key={option.id} data-print-field={option.label}>{revisedRowState(run.checklist,'task-',option.indices).checked?<><b>✓</b> {option.label}</>:'Actual Run'}</span>)}</span>:undefined;
  return <PrintTitleBlock title={title} formId={formNumber} revisionKey={formNumber||'reporting_for_duty'} marker={marker}>
    <span><b>Date:</b> {runDate??formatDateDMY(report.date)}</span><span><b>Time:</b> {runTime??report.shiftStartTime??'Not recorded'}</span><span>{phaseLabel(report.phase)} · {shiftDisplayLabel(report.shift)}</span><b className="print-folder-page-reference" data-training-folder-page={pageReference}>{pageReference??'Training-folder reference unavailable'}</b>{subtitle&&<span>{subtitle}</span>}
  </PrintTitleBlock>;
}

function People({report}:{report:Report}) {
  return <PrintFieldGrid className="print-run-meta">
    <PrintField label="Probationary Officer">{report.recruitName}</PrintField>
    <PrintField label="PO Badge">{report.recruitBadge}</PrintField>
    <PrintField label="Field Training Officer">{report.ftoName}</PrintField>
    <PrintField label="FTO Badge">{report.ftoBadge}</PrintField>
    <PrintField label="Class">{report.className||'—'}</PrintField>
    <PrintField label="FTO Assignment">{phaseAssignmentLabel(report.ftoAssignment,report.shift,report.cruiserDistrict)}</PrintField>
  </PrintFieldGrid>;
}

function DutyPage({report,pageReference}:{report:Report;pageReference?:string}) {
  const record=report.reportingForDuty;
  return <PrintDocument className="print-run-page print-duty-page" data-testid="print-duty-form">
    <PageHeader title="Reporting for Duty Form" formNumber="" report={report} pageReference={pageReference}/>
    <People report={report}/>
    <div className="print-run-legend">Checklist items start checked. Review each item and clear anything not completed acceptably; Not applicable remains unchecked unless explicitly selected.</div>
    <div className="print-duty-checklist-grid">{DAILY_DUTY_CHECKLIST.map(group=><section className="print-run-checkgroup" key={group.section}>
      <h2>{group.section} {record?.notApplicable?.[group.section]?'· NOT APPLICABLE':''}</h2>
      <ul style={{'--print-checklist-rows':group.items.length} as React.CSSProperties}>{group.items.map(item=><PrintChecklistRow key={item.key} checked={record?.checklist?.[item.key]!==false} label={item.label}/>)}</ul>
    </section>)}</div>
    <p className="print-run-notes"><b>Duty status:</b> {record?.dutyStatus||'—'}{record?.cruiserId&&<> · <b>Cruiser ID:</b> {record.cruiserId}</>}{record?.shotgunTraining&&<> · <b>Shotgun Training:</b> {record.shotgunTraining}</>} · <b>Notes:</b> {record?.notes||'—'}</p>
    <footer className="print-run-footer">Duty checklist review: {record?.reviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.<PrintableColumbusFooterMarks /></footer>
  </PrintDocument>;
}

function RunPage({report,run,pageReference,narrativeReferences}:{report:Report;run:TrainingRun;pageReference?:string;narrativeReferences:(string|undefined)[]}) {
  const form=PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind);
  const code=RADIO_CODES[run.dispatchedCode??''];
  const situation=run.situationFoundCode===SITUATION_FOUND_NA?'':RADIO_CODES[run.situationFoundCode??''];
  const clearance=CLEARANCE_CODES.find(item=>item.code===run.clearanceCode);
  const citationSummons=!!run.activityFlags?.solveCitationSummons;
  const relatedActivity=DAILY_ACTIVITY_FIELDS.filter(item=>item.key!=='solveCitationSummons'&&run.activityFlags?.[item.key]);
  const attachedForms=requiredSupplementalForms(run).map(key=>SUPPLEMENTAL_RUN_FORMS.find(form=>form.key===key)?.label).filter(Boolean);
  const additionalItems=[...attachedForms,...relatedActivity.map(item=>item.label)];
  const trafficStop=run.runKind==='traffic_stop'||run.runKind==='high_risk_stop';
  const {sections}=partitionRevisedChecklist(REVISED_PRIMARY_CHECKLISTS[run.runKind]);
  const failureLines=runFailureStatements(run).map(statement=>statement.text);
  const narrativeSupport=<PrintNotesArea title="Run narrative">{narrativeReferences.length?`Continued on ${narrativeReferences.filter(Boolean).join(', ')||'the following narrative continuation page'}.`:<>{failureLines.map(line=><span key={line} className="print-po-failed-line">{line} </span>)}{run.narrative||(failureLines.length?'':'—')}</>}</PrintNotesArea>;
  const separateNarrative=sections.length===9;
  const support=<><DirectiveReviewPrint run={run} formKey={run.runKind} prefix="task-"/>{!separateNarrative&&narrativeSupport}</>;
  const insetSupport=sections.length===7;
  return <PrintDocument className={`print-run-page ${run.runKind==='traffic_stop'||run.runKind==='building_search'?'print-run-dense':''}`} data-form-key={run.runKind} data-testid={`print-run-${run.id}`}>
    <PageHeader title={form?.label||'Primary Run Form'} formNumber={form?.formNumber||''} report={report} run={run} pageReference={pageReference} subtitle={`Run ${formatTime(run.occurredAt)} · ${run.formStatus.replace('_',' ')}`}/>
    <People report={report}/>
    <PrintFieldGrid className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Unit / cruiser" value={run.unitNumber||'Not recorded'}/>
      <Field label="Location" value={formattedRunLocation(run)}/>
      <Field label="Zone / cruiser district" value={formattedIncidentArea(run)}/>
      <Field label="Run started" value={formatDateTimeMDY(run.occurredAt)}/>
      <Field label="Dispatched at" value={run.dispatchedAt?formatDateTimeMDY(run.dispatchedAt):'Not recorded'}/>
      <Field label="Run ended" value={run.endedAt?formatDateTimeMDY(run.endedAt):'Not recorded'}/>
      <Field label="Run type / 10-code" value={run.dispatchedCode?`10-${run.dispatchedCode}${code?` · ${code}`:''}`:'—'}/>
      <Field label="Situation found / 10-code" value={`${formatRadioCode(run.situationFoundCode,'')}${situation?` · ${situation}`:''}`}/>
      <Field label="Clearance code" value={run.clearanceCode?`${run.clearanceCode}${clearance?` · ${clearance.label}`:''}`:'—'}/>
      {trafficStop&&run.trafficMode!=='none'&&<Field label="Traffic violator" value={run.trafficMode.replaceAll('_',' ')}/>}
      {additionalItems.length>0&&<Field label="Additional activity / forms" value={additionalItems.join('; ')}/>}
    </PrintFieldGrid>
    <div className="print-run-status">
      <span data-print-field="Dispatched"><b>Dispatched:</b> {run.isDispatched?'Yes':'No'}</span>
      <span data-print-field="Arrest / transport"><b>Arrest / transport:</b> {`${run.arrestMade?'Arrest made':'No arrest'}${run.transportedAfterArrest?` · ${run.transportDestinationType??'destination type not recorded'} · transported to ${run.transportDestination?.trim()||'destination not recorded'}`:''}`}</span>
      <span data-print-field="OVI processed"><b>OVI processed:</b> {run.oviProcessed?'Yes':'No'}</span>
      {citationSummons&&<span data-print-field="Solve Citation/Summons*"><b>Solve Citation/Summons*:</b> 1</span>}
    </div>
      <Checklist title="Primary form checklist" sections={sections} state={run.checklist} failures={run.checklistFailures} itemNotApplicable={run.checklistNotApplicable} prefix="task-" notApplicable={!!run.checklist['na-task']} support={support} tail={insetSupport?support:undefined}/>
    {separateNarrative&&narrativeSupport}
    <PrintFooter className="print-run-footer">Checklist review: {run.checklistReviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.<span className="print-source-note">Division directive index revised {DIVISION_DIRECTIVE_SOURCE_REVISION}.</span></PrintFooter>
  </PrintDocument>;
}

function SupplementPage({report,run,formKey,pageReference,narrativeReferences}:{report:Report;run:TrainingRun;formKey:typeof SUPPLEMENTAL_RUN_FORMS[number]['key'];pageReference?:string;narrativeReferences:(string|undefined)[]}) {
  const form=SUPPLEMENTAL_RUN_FORMS.find(item=>item.key===formKey);
  const support=<><DirectiveReviewPrint run={run} formKey={formKey} prefix={`supp-${formKey}-`}/><section className="print-run-narrative"><b>Related primary narrative</b><p>{narrativeReferences.length?`Continued on ${narrativeReferences.filter(Boolean).join(', ')||'the narrative continuation page'}.`:run.narrative||'—'}</p></section></>;
  const insetSupport=REVISED_SUPPLEMENT_CHECKLISTS[formKey].length===7;
  return <PrintDocument className="print-run-page print-run-dense" data-form-key={formKey} data-testid={`print-supplement-${run.id}-${formKey}`}>
    <PageHeader title={form?.label||'Supplemental Form'} formNumber={form?.formNumber||''} report={report} run={run} pageReference={pageReference} subtitle={`Related run · ${formatTime(run.occurredAt)}`}/>
    <People report={report}/>
    <PrintFieldGrid className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Unit / cruiser" value={run.unitNumber||'Not recorded'}/>
      <Field label="Location" value={formattedRunLocation(run)}/>
      <Field label="Zone / cruiser district" value={formattedIncidentArea(run)}/>
      <Field label="Dispatched at" value={run.dispatchedAt?formatDateTimeMDY(run.dispatchedAt):'Not recorded'}/>
      <Field label="Run ended" value={run.endedAt?formatDateTimeMDY(run.endedAt):'Not recorded'}/>
      <Field label="Primary run" value={PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind)?.label||run.runKind}/>
      {run.trafficMode!=='none'&&<Field label="Traffic violator" value={run.trafficMode.replaceAll('_',' ')}/>}
    </PrintFieldGrid>
    <div className="print-run-status">
      <span data-print-field="Arrest made"><b>Arrest made:</b> {run.arrestMade?'Yes':'No'}</span>
      <span data-print-field="Transported after arrest"><b>Transported after arrest:</b> {run.transportedAfterArrest?`Yes · ${run.transportDestinationType??'destination type not recorded'} · ${run.transportDestination?.trim()||'destination not recorded'}`:'No'}</span>
      <span data-print-field="OVI processed"><b>OVI processed:</b> {run.oviProcessed?'Yes':'No'}</span>
      <span data-print-field="Dispatched"><b>Dispatched:</b> {run.isDispatched?'Yes':'No'}</span>
    </div>
      {REVISED_SUPPLEMENT_CHECKLISTS[formKey].length>0&&<Checklist title={`${form?.label||'Supplemental'} checklist`} sections={REVISED_SUPPLEMENT_CHECKLISTS[formKey]} state={run.checklist} failures={run.checklistFailures} itemNotApplicable={run.checklistNotApplicable} prefix={`supp-${formKey}-`} notApplicable={!!run.checklist[`na-supp-${formKey}`]} support={support} tail={insetSupport?support:undefined}/>}
    <footer className="print-run-footer">Checklist review: {run.checklistReviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.<span className="print-source-note">Division directive index revised {DIVISION_DIRECTIVE_SOURCE_REVISION}.</span><PrintableColumbusFooterMarks /></footer>
  </PrintDocument>;
}

function DirectiveReviewPrint({run,formKey,prefix}:{run:TrainingRun;formKey:DirectiveReviewForm;prefix:string}) {
  const primary=PRIMARY_RUN_FORMS.some(form=>form.key===formKey);
  const labels=primary
    ?RUN_CHECKLIST_SECTIONS[formKey as PrimaryRunForm].flatMap(section=>section.items.map(item=>item.label))
    :RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey as typeof SUPPLEMENTAL_RUN_FORMS[number]['key']].flatMap(section=>section.items.map(item=>item.label));
  const index=labels.indexOf(DIRECTIVE_REVIEW_LABEL);
  if(index<0)return null;
  if(run.checklist[`${prefix}${index}`]===false)return <div className="print-directive-review"><b>Training materials reviewed</b><p>Not completed / not applicable.</p></div>;
  const details={...defaultDirectiveReviewRecord(),...(run.directiveReviews?.[formKey]??{})};
  const materials=reviewedTrainingMaterials(details);
  return <div className="print-directive-review">
    <b>Training materials reviewed</b>
    <p className="print-material-checks">
      {[
        {label:'Division Directives',checked:details.divisionDirectives},
        {label:'Ohio Revised Code',checked:details.ohioRevisedCode},
        {label:'Columbus City Code',checked:details.columbusCityCode},
        {label:'Other',checked:details.other},
      ].map(choice=><span key={choice.label}><b>{choice.checked?'☒':'☐'}</b>{choice.label}</span>)}
    </p>
    <table className="print-materials-table">
      <thead><tr><th>Type</th><th>Reference or material</th></tr></thead>
      <tbody>{materials.map((material,index)=><tr key={`${material.type}-${material.reference}-${index}`}><td>{material.type}</td><td>{material.reference}</td></tr>)}
        {!materials.length&&<tr><td colSpan={2}>No specific reference recorded.</td></tr>}
      </tbody>
    </table>
  </div>;
}

function NarrativeContinuationPages({report,run,pageReferences}:{report:Report;run:TrainingRun;pageReferences:(string|undefined)[]}) {
  const pages=splitNarrativeContinuation(run.narrative||'');
  return <Fragment>{pages.map((text,index)=>{
    const reference=pageReferences[index];
    return <PrintDocument className="print-run-page print-narrative-page" key={`${run.id}-continuation-${index}`} data-testid={`print-narrative-continuation-${run.id}-${index+1}`}>
    <PageHeader title="Narrative Addition / Continuation" formNumber="U-10.192" report={report} run={run} pageReference={reference} subtitle={`Related run ${formatTime(run.occurredAt)}`}/>
    <People report={report}/>
    <div className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Location" value={run.location||'Not recorded'}/>
      <Field label="Run date and time" value={formatDateTimeMDY(run.occurredAt)}/>
      <Field label="Primary form" value={PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind)?.label||run.runKind}/>
    </div>
    <section className="print-run-narrative print-narrative-continuation"><b>Narrative · continuation</b><p>{text||' '}</p></section>
    <footer className="print-run-footer">Narrative continued from the related run record · {reference??'Training-folder reference unavailable'}.<PrintableColumbusFooterMarks /></footer>
    </PrintDocument>;
  })}</Fragment>;
}


function PrintRowLabel({label,indices,state,prefix,itemNotApplicable}:{label:string;indices:readonly number[];state:Record<string,boolean>;prefix:string;itemNotApplicable?:Record<string,true>}) {
  const parts=rowSegments(label,indices);
  if(!parts)return <>{label}</>;
  return <>{parts.map((part,position)=>{
    const key=`${prefix}${indices[position]}`;
    const na=itemNotApplicable?.[key]===true&&state[key]===false;
    const failed=state[key]===false&&!na;
    return <Fragment key={key}>{position>0&&' / '}<span className={na?'print-item-na':failed?'print-item-failed':undefined}>{part}</span></Fragment>;
  })}</>;
}

function Checklist({title,sections,state,failures,prefix,notApplicable,itemNotApplicable,tail,support}:{title:string;sections:readonly RevisedChecklistSection[];state:Record<string,boolean>;failures?:Record<string,string[]>;prefix:string;notApplicable:boolean;itemNotApplicable?:Record<string,true>;tail?:React.ReactNode;support:React.ReactNode}) {
  const introduction=<><h2>{title}</h2><p>Not applicable: {notApplicable?'Yes':'No'} · ☒ complete · ☐ not complete · ◩ partly completed. A combined row is complete only when all listed actions are complete. New items start checked; the FTO must verify each row.</p></>;
  return <section className="print-run-checklist">
    <div className="print-checklist-intro">{introduction}</div>
    <div className="print-run-checklist-groups" data-category-count={sections.length}>
      {sections.map((section,index)=><PrintSectionPanel className="print-run-checkgroup" key={section.title} title={section.title} heading={3}><ul style={{'--print-checklist-rows':section.items.length} as React.CSSProperties}>{section.items.map(item=>{
        const value=revisedRowState(state,prefix,item.indices);
        const failedActions=item.indices.flatMap(index=>failures?.[`${prefix}${index}`]??[]);
        return <PrintChecklistRow key={item.id} label={item.label} labelContent={<PrintRowLabel label={item.label} indices={item.indices} state={state} prefix={prefix} itemNotApplicable={itemNotApplicable}/>} help={item.help} {...value}
          details={failedActions.length>0?<span className="print-run-failure-detail">{failedActions.map((action,actionIndex)=><span key={`${actionIndex}-${action}`}><span>Not completed: </span><strong>{action}</strong></span>)}</span>:undefined}/>;
      })}</ul>{index===sections.length-1&&!tail&&<div className="print-equal-support">{support}</div>}</PrintSectionPanel>)}
      {tail&&<div className="print-equal-support">{tail}</div>}
    </div>
  </section>;
}

function Field({label,value}:{label:string;value:string}) {
  return <PrintField label={label}>{value||'—'}</PrintField>;
}

function formatTime(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
