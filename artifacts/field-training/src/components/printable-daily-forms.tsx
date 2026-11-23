import React, { Fragment } from 'react';
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
import { PrintableSubstationOrientation } from '@/components/printable-extended-forms.js';
import type { SubstationOrientationRecord } from '@/lib/model.js';
import { splitNarrativeContinuation } from '@/lib/narrative-continuation.js';
import { buildOperationalPacket, type OperationalPacket } from '@/lib/operational-state-machine.js';
import { DIVISION_DIRECTIVE_SOURCE_REVISION } from '@/lib/division-directives.js';
import { reviewedTrainingMaterials } from '@/lib/training-materials.js';

export function PrintableDailyForms({ report,orientation,dayReference,packet:providedPacket }: { report:Report;orientation?:SubstationOrientationRecord;dayReference?:TrainingFolderDayReference;packet?:OperationalPacket }) {
  const packet = providedPacket ?? buildOperationalPacket(report, { orientation, dayReference });
  const orientationReference = packet.pages.find(page => page.kind === 'orientation')?.reference;
  const orientationContinuationReference = packet.pages.find(page => page.kind === 'orientation_continuation')?.reference;
  const dutyReference = packet.pages[0]?.reference;
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
    <DutyPage report={report} pageReference={dutyReference}/>
    {orientation&&<PrintableSubstationOrientation record={orientation} pageReference={orientationReference} continuationPageReference={orientationContinuationReference}/>}
    {orderedRuns.map(run=>{
      const references=runReferences.get(run.id);
      return <Fragment key={run.id}>
        <RunPage report={report} run={run} pageReference={references?.primary} narrativeReferences={references?.narratives??[]}/>
        {requiredSupplementalForms(run).filter(form=>form!=='narrative_addition').map(form=><SupplementPage key={form} report={report} run={run} formKey={form} pageReference={references?.supplements.get(form)} narrativeReferences={references?.narratives??[]}/>)}
        {!!references?.narratives.length&&<NarrativeContinuationPages key={`narrative-${run.id}`} report={report} run={run} pageReferences={references.narratives}/>}
      </Fragment>;
    })}
  </section>;
}

function PageHeader({ title, formNumber, report, run, subtitle, pageReference }:{title:string;formNumber:string;report:Report;run?:TrainingRun;subtitle?:string;pageReference?:string}) {
  const [runDate,runTime]=run?formatDateTimeMDY(run.occurredAt).split(' '):[];
  return <header className="print-run-header">
    <div><p>Columbus Division of Police · Field Training Program</p><h1>{title}</h1>{formNumber&&<b>{formNumber}</b>}</div>
    <div className="print-run-header-meta"><span><b>Date:</b> {runDate??formatDateDMY(report.date)}</span><span><b>Time:</b> {runTime??report.shiftStartTime??'Not recorded'}</span><span>{phaseLabel(report.phase)} · {shiftDisplayLabel(report.shift)}</span><b className="print-folder-page-reference" data-training-folder-page={pageReference}>{pageReference??'Training-folder reference unavailable'}</b>{subtitle&&<span>{subtitle}</span>}</div>
  </header>;
}

function People({report}:{report:Report}) {
  return <div className="print-run-meta">
    <span><b>Probationary Officer</b>{report.recruitName} · Badge {report.recruitBadge}</span>
    <span><b>FTO</b>{report.ftoName} · Badge {report.ftoBadge}</span>
    <span><b>Class</b>{report.className||'—'}</span>
    <span><b>FTO assignment</b>{phaseAssignmentLabel(report.ftoAssignment,report.shift)}</span>
  </div>;
}

function DutyPage({report,pageReference}:{report:Report;pageReference?:string}) {
  const record=report.reportingForDuty;
  return <article className="print-run-page" data-testid="print-duty-form">
    <PageHeader title="Reporting for Duty Form" formNumber="" report={report} pageReference={pageReference}/>
    <People report={report}/>
    <div className="print-run-legend">Checklist items start checked. Review each item and clear anything not completed acceptably; Not applicable remains unchecked unless explicitly selected.</div>
    {DAILY_DUTY_CHECKLIST.map(group=><section className="print-run-checkgroup" key={group.section}>
      <h2>{group.section} {record?.notApplicable?.[group.section]?'· NOT APPLICABLE':''}</h2>
      <ul>{group.items.map(item=><li key={item.key}><b>{record?.checklist?.[item.key]!==false?'☒':'☐'}</b>{item.label}</li>)}</ul>
    </section>)}
    <p className="print-run-notes"><b>Duty status:</b> {record?.dutyStatus||'—'}{record?.cruiserId&&<> · <b>Cruiser ID:</b> {record.cruiserId}</>}{record?.shotgunTraining&&<> · <b>Shotgun Training:</b> {record.shotgunTraining}</>} · <b>Notes:</b> {record?.notes||'—'}</p>
    <footer className="print-run-footer">Duty checklist review: {record?.reviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.</footer>
  </article>;
}

function RunPage({report,run,pageReference,narrativeReferences}:{report:Report;run:TrainingRun;pageReference?:string;narrativeReferences:(string|undefined)[]}) {
  const form=PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind);
  const code=RADIO_CODES[run.dispatchedCode??''];
  const situation=run.situationFoundCode===SITUATION_FOUND_NA?'':RADIO_CODES[run.situationFoundCode??''];
  const clearance=CLEARANCE_CODES.find(item=>item.code===run.clearanceCode);
  const citationSummons=!!run.activityFlags?.solveCitationSummons;
  const relatedActivity=DAILY_ACTIVITY_FIELDS.filter(item=>item.key!=='solveCitationSummons'&&run.activityFlags?.[item.key]);
  const trafficStop=run.runKind==='traffic_stop'||run.runKind==='high_risk_stop';
  return <article className="print-run-page" data-testid={`print-run-${run.id}`}>
    <PageHeader title={form?.label||'Primary Run Form'} formNumber={form?.formNumber||''} report={report} run={run} pageReference={pageReference} subtitle={`Run ${formatTime(run.occurredAt)} · ${run.formStatus.replace('_',' ')}`}/>
    <People report={report}/>
    <div className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Location" value={run.location||'Not recorded'}/>
      <Field label="Run started" value={formatDateTimeMDY(run.occurredAt)}/>
      <Field label="Run ended" value={run.endedAt?formatDateTimeMDY(run.endedAt):'Not recorded'}/>
      <Field label="Run type / 10-code" value={run.dispatchedCode?`10-${run.dispatchedCode}${code?` · ${code}`:''}`:'—'}/>
      <Field label="Situation found / 10-code" value={`${formatRadioCode(run.situationFoundCode,'N/A')}${situation?` · ${situation}`:''}`}/>
      <Field label="Clearance code" value={run.clearanceCode?`${run.clearanceCode}${clearance?` · ${clearance.label}`:''}`:'—'}/>
      <Field label="Dispatched" value={run.isDispatched?'Yes':'No'}/>
      {trafficStop&&<Field label="Traffic violator" value={run.trafficMode.replace('_',' ')||'—'}/>}
      {citationSummons&&<Field label="Solve Citation/Summons*" value="1"/>}
      {relatedActivity.length>0&&<Field label="Additional activity / forms" value={relatedActivity.map(item=>item.label).join('; ')}/>}
       <Field label="Arrest / transport" value={`${run.arrestMade?'Arrest made':'No arrest'}${run.transportedAfterArrest?` · ${run.transportDestinationType??'destination type not recorded'} · transported to ${run.transportDestination?.trim()||'destination not recorded'}`:''}`}/>
      <Field label="OVI processed" value={run.oviProcessed?'Yes':'No'}/>
    </div>
    <Checklist title="Primary form checklist" sections={RUN_CHECKLIST_SECTIONS[run.runKind]} state={run.checklist} prefix="task-" notApplicable={!!run.checklist['na-task']}/>
     <DirectiveReviewPrint run={run} formKey={run.runKind} prefix="task-"/>
     <section className="print-run-narrative"><b>Run narrative</b><p>{narrativeReferences.length?`Continued on ${narrativeReferences.filter(Boolean).join(', ')||'the following narrative continuation page'}.`:run.narrative||'—'}</p></section>
    <footer className="print-run-footer">Checklist review: {run.checklistReviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.</footer>
  </article>;
}

function SupplementPage({report,run,formKey,pageReference,narrativeReferences}:{report:Report;run:TrainingRun;formKey:typeof SUPPLEMENTAL_RUN_FORMS[number]['key'];pageReference?:string;narrativeReferences:(string|undefined)[]}) {
  const form=SUPPLEMENTAL_RUN_FORMS.find(item=>item.key===formKey);
  return <article className="print-run-page" data-testid={`print-supplement-${run.id}-${formKey}`}>
    <PageHeader title={form?.label||'Supplemental Form'} formNumber={form?.formNumber||''} report={report} run={run} pageReference={pageReference} subtitle={`Related run · ${formatTime(run.occurredAt)}`}/>
    <People report={report}/>
    <div className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Location" value={run.location||'Not recorded'}/>
      <Field label="Run ended" value={run.endedAt?formatDateTimeMDY(run.endedAt):'Not recorded'}/>
      <Field label="Primary run" value={PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind)?.label||run.runKind}/>
      <Field label="Arrest made" value={run.arrestMade?'Yes':'No'}/>
       <Field label="Transported after arrest" value={run.transportedAfterArrest?`Yes · ${run.transportDestinationType??'destination type not recorded'} · ${run.transportDestination?.trim()||'destination not recorded'}`:'No'}/>
      <Field label="OVI processed" value={run.oviProcessed?'Yes':'No'}/>
      <Field label="Dispatched" value={run.isDispatched?'Yes':'No'}/>
      <Field label="Traffic violator" value={run.trafficMode==='none'?'—':run.trafficMode.replace('_',' ')}/>
    </div>
     {RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey].length>0&&<Checklist title={`${form?.label||'Supplemental'} checklist`} sections={RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey]} state={run.checklist} prefix={`supp-${formKey}-`} notApplicable={!!run.checklist[`na-supp-${formKey}`]}/>}
     <DirectiveReviewPrint run={run} formKey={formKey} prefix={`supp-${formKey}-`}/>
     <section className="print-run-narrative"><b>Related primary narrative</b><p>{narrativeReferences.length?`Continued on ${narrativeReferences.filter(Boolean).join(', ')||'the narrative continuation page'}.`:run.narrative||'—'}</p></section>
    <footer className="print-run-footer">Checklist review: {run.checklistReviewedAt?'Confirmed on this device':'Not confirmed'} · Not an identity-verified or electronically signed record.</footer>
  </article>;
}

function DirectiveReviewPrint({run,formKey,prefix}:{run:TrainingRun;formKey:DirectiveReviewForm;prefix:string}) {
  const primary=PRIMARY_RUN_FORMS.some(form=>form.key===formKey);
  const labels=primary
    ?RUN_CHECKLIST_SECTIONS[formKey as PrimaryRunForm].flatMap(section=>section.items.map(item=>item.label))
    :RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey as typeof SUPPLEMENTAL_RUN_FORMS[number]['key']].flatMap(section=>section.items.map(item=>item.label));
  const index=labels.indexOf(DIRECTIVE_REVIEW_LABEL);
  if(index<0||run.checklist[`${prefix}${index}`]===false)return null;
  const details={...defaultDirectiveReviewRecord(),...(run.directiveReviews?.[formKey]??{})};
  const materials=reviewedTrainingMaterials(details);
  return <div className="print-directive-review">
    <b>Training materials reviewed</b>
    <p className="print-material-checks">
      {details.divisionDirectives?'☒':'☐'} Division Directives · {details.ohioRevisedCode?'☒':'☐'} Ohio Revised Code · {details.columbusCityCode?'☒':'☐'} Columbus City Code · {details.other?'☒':'☐'} Other
    </p>
    <table className="print-materials-table">
      <thead><tr><th>Type</th><th>Reference or material</th></tr></thead>
      <tbody>{materials.map((material,index)=><tr key={`${material.type}-${material.reference}-${index}`}><td>{material.type}</td><td>{material.reference}</td></tr>)}
        {!materials.length&&<tr><td colSpan={2}>No specific reference recorded.</td></tr>}
      </tbody>
    </table>
    <p className="print-material-source">Division directive index revised {DIVISION_DIRECTIVE_SOURCE_REVISION}.</p>
  </div>;
}

function NarrativeContinuationPages({report,run,pageReferences}:{report:Report;run:TrainingRun;pageReferences:(string|undefined)[]}) {
  const pages=splitNarrativeContinuation(run.narrative||'');
  return <Fragment>{pages.map((text,index)=>{
    const reference=pageReferences[index];
    return <article className="print-run-page print-narrative-page" key={`${run.id}-continuation-${index}`} data-testid={`print-narrative-continuation-${run.id}-${index+1}`}>
    <PageHeader title="Narrative Addition / Continuation" formNumber="U-10.192" report={report} run={run} pageReference={reference} subtitle={`Related run ${formatTime(run.occurredAt)}`}/>
    <People report={report}/>
    <div className="print-run-fields">
      <Field label="Incident number" value={run.incidentNumber||'Not recorded'}/>
      <Field label="Location" value={run.location||'Not recorded'}/>
      <Field label="Run date and time" value={formatDateTimeMDY(run.occurredAt)}/>
      <Field label="Primary form" value={PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind)?.label||run.runKind}/>
    </div>
    <section className="print-run-narrative print-narrative-continuation"><b>Narrative · continuation</b><p>{text||' '}</p></section>
    <footer className="print-run-footer">Narrative continued from the related run record · {reference??'Training-folder reference unavailable'}.</footer>
  </article>;
  })}</Fragment>;
}


function Checklist({title,sections,state,prefix,notApplicable}:{title:string;sections:readonly {title:string;items:readonly {label:string;help:string}[]}[];state:Record<string,boolean>;prefix:string;notApplicable:boolean}) {
  let offset=0;
  return <section className="print-run-checklist">
    <h2>{title}</h2><p>Not applicable: {notApplicable?'Yes':'No'} · ☒ checked · ☐ unchecked. New task items start checked; the FTO must verify each item and clear anything not completed acceptably.</p>
    {sections.map(section=>{const start=offset;offset+=section.items.length;return <section className="print-run-checkgroup" key={section.title||start}>{section.title&&<h3>{section.title}</h3>}<ul>{section.items.map((item,index)=><li key={start+index} title={item.help}><b>{state[`${prefix}${start+index}`]!==false?'☒':'☐'}</b>{item.label}</li>)}</ul></section>})}
  </section>;
}

function Field({label,value}:{label:string;value:string}) {
  return <span><b>{label}</b>{value||'—'}</span>;
}

function formatTime(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
