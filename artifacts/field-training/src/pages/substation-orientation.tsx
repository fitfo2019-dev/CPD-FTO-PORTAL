import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCheck, Printer } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { PrintableSubstationOrientation } from '@/components/printable-extended-forms.js';
import { useToast } from '@/hooks/use-toast.js';
import { uid, type SubstationOrientationRecord } from '@/lib/model.js';
import { SUBSTATION_ORIENTATION_SECTIONS, SUBSTATION_ORIENTATION_KEYS, defaultSubstationOrientationChecklist } from '@/lib/substation-orientation.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { CPD_SUBSTATIONS, CPD_SUBSTATION_DIRECTORY_URL, defaultSubstationForAssignment, getSubstation } from '@/lib/substations.js';
import { formatDateDMY, formatDateTimeMDY, formatDateTimeEntryMDY, formatTrainingFolderPageReference, getNextReportDate, getTrainingFolderDayReference, parseDateDMY, splitDateTimeEntryMDY } from '@/lib/training-calendar.js';
import { parseRunDateTime } from '@/lib/run-details.js';
import { useWorkspace } from '@/state/workspace.js';

export default function SubstationOrientationPage() {
  const {ws,vault,upsertSubstationOrientation}=useWorkspace();
  const [,navigate]=useLocation();
  const {toast}=useToast();
  useEffect(()=>{
    document.body.classList.add('print-substation-route');
    return()=>document.body.classList.remove('print-substation-route');
  },[]);
  const folder=ws.caseFolder;
  const canAccess=ws.role==='fto'||ws.role==='fto_coordinator';
  const canEdit=ws.role==='fto';
  const firstDay=folder ? getNextReportDate(folder,[]) : '';
  const orientationDayReference=folder&&firstDay
    ?getTrainingFolderDayReference(folder.phase,firstDay,folder.phaseStartDate,folder.daysOff)
    :undefined;
  const orientationPageReference=formatTrainingFolderPageReference(orientationDayReference,2);
  const orientationContinuationPageReference=formatTrainingFolderPageReference(orientationDayReference,3);
  const defaultSubstation=folder ? defaultSubstationForAssignment(folder) : '';
  const existing=folder ? ws.substationOrientations.find(item=>item.recruitBadge===folder.recruitBadge&&item.className===folder.className&&item.phaseStartDate===firstDay&&(item.phase??1)===folder.phase) : undefined;
  const initial=useMemo<SubstationOrientationRecord|null>(()=>folder?existing
    ?{...existing,phase:existing.phase??folder.phase,substation:existing.substation||defaultSubstation}
    :{
      id:uid(),className:folder.className??'',recruitName:folder.recruitName,recruitBadge:folder.recruitBadge,
      ftoName:folder.ftoName,ftoBadge:folder.ftoBadge,phase:folder.phase,phaseStartDate:firstDay,dateTime:'',substation:defaultSubstation,
      checklist:defaultSubstationOrientationChecklist(),checklistReviewedAt:undefined,directivesReview:'',narrative:'',updatedAt:new Date().toISOString(),
    }:null,[folder,existing,firstDay,defaultSubstation]);
  const [record,setRecord]=useState<SubstationOrientationRecord|null>(initial);
  const [dateTimeText,setDateTimeText]=useState(initial?.dateTime?formatDateTimeMDY(initial.dateTime):firstDay?`${formatDateDMY(firstDay)} `:'');
  useEffect(()=>{
    setRecord(initial);
    setDateTimeText(initial?.dateTime?formatDateTimeMDY(initial.dateTime):firstDay?`${formatDateDMY(firstDay)} `:'');
  },[initial,firstDay]);
  const checked=SUBSTATION_ORIENTATION_KEYS.filter(key=>record?.checklist[key]!==false).length;
  const selectedSubstation=getSubstation(record?.substation??'');
  if(!canAccess) return <Panel title="Substation Orientation access"><p className="p-4">This form is available to FTOs and the FTO Coordinator.</p></Panel>;
  if(!folder||!record) return <Panel title="Substation Orientation"><div className="p-4 text-sm"><p>Open the active phase case folder to prefill the PO and FTO before completing this first-day form.</p><Link href="/phase-setup" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Open Phase Setup</Link></div></Panel>;
  if(ws.role==='fto_coordinator'&&!existing) return <Panel title="Substation Orientation"><p className="p-4 text-sm">No saved orientation record is available to review. The assigned FTO completes this first-day form.</p></Panel>;

  const update=<K extends keyof SubstationOrientationRecord>(key:K,value:SubstationOrientationRecord[K])=>setRecord(current=>current?{...current,[key]:value,updatedAt:new Date().toISOString()}:current);
  const updateChecklist=(checklist:Record<string,boolean>)=>setRecord(current=>current?{...current,checklist,checklistReviewedAt:undefined,updatedAt:new Date().toISOString()}:current);
  const confirmChecklistReview=()=>setRecord(current=>current?{...current,checklistReviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:current);
  const save=()=>{
    if(!record.checklistReviewedAt){toast({title:'Review the orientation checklist',description:'Keep checked only the items completed during the walkthrough, clear the rest, then confirm the review.',variant:'destructive'});return;}
    const dateTime=parseRunDateTime(dateTimeText);
    if(!dateTime){toast({title:'Enter the date and time',description:'Use MM/DD/YYYY HH:MM for the first training day.',variant:'destructive'});return;}
    if(parseDateDMY(splitDateTimeEntryMDY(dateTimeText).date)!==firstDay){
      toast({title:'Use the first scheduled training day',description:`This form is marked for ${formatDateDMY(firstDay)}.`,variant:'destructive'});return;
    }
     const saved={...record,dateTime,phase:folder.phase,phaseStartDate:firstDay,updatedAt:new Date().toISOString()};
    upsertSubstationOrientation(saved);setRecord(saved);
     toast({title:'Phase orientation saved on this device',description:vault==='unlocked'?'Encrypted local autosave is in progress. The shift form is opening next.':'It is only in memory until you open the local vault and save this device workspace.'});
     navigate('/reports/new');
  };
  const checklistReviewed=!!record.checklistReviewedAt;
  return <div className="orientation-page mx-auto max-w-5xl">
     <PageHead kicker={`Phase ${folder.phase} · first scheduled day`} title="Substation Orientation · U-10.181">
      <button type="button" onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded border border-primary/25 bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted" data-testid="button-print-orientation"><Printer className="h-4 w-4"/>Print / PDF</button>
    </PageHead>
    <div className="orientation-guidance mb-4 rounded border p-3 text-sm">
       Complete this before the first shift of each phase. The form is dated for the phase’s first scheduled workday. Every checklist item starts checked for quick review; clear anything not completed during the walkthrough, then confirm the review before saving. Values stay in this device’s local workspace.
    </div>
    {!canEdit&&<div className="mb-4 rounded border bg-muted/30 p-3 text-sm">FTO Coordinator view is read-only. The assigned FTO completes and saves this orientation.</div>}
    <Panel title="PO, FTO, substation, and date" className="orientation-panel">
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Probationary Officer<input value={`${record.recruitName} · ${record.recruitBadge}`} readOnly className="h-11 rounded border bg-muted px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-semibold">Field Training Officer<input value={`${record.ftoName} · ${record.ftoBadge}`} readOnly className="h-11 rounded border bg-muted px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-semibold">Substation
          <SearchableSelect disabled={!canEdit} value={record.substation} onChange={event=>update('substation',event.target.value)} className="h-11 w-full rounded border bg-card px-3 font-normal" data-testid="input-orientation-substation">
            <option value="">Select substation</option>
            {CPD_SUBSTATIONS.map(station=><option key={station.id} value={station.id} data-search={`${station.address} ${station.city} ${station.zip} ${station.phone}`}>Substation {station.id}</option>)}
          </SearchableSelect>
          <span className="text-xs font-normal text-muted-foreground">Type a station number, street, or phone number to find another location.</span>
        </label>
        {selectedSubstation&&<div className="rounded border bg-muted/30 p-3 text-sm sm:col-span-2" data-testid="substation-location-details">
          <p className="font-semibold">Substation {selectedSubstation.id}</p>
          <p>{selectedSubstation.address}, {selectedSubstation.city} {selectedSubstation.zip} · {selectedSubstation.phone}</p>
          <div className="mt-1 flex flex-wrap gap-x-4">
            <a className="inline-flex min-h-8 items-center font-semibold underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedSubstation.address}, ${selectedSubstation.city} ${selectedSubstation.zip}`)}`} target="_blank" rel="noreferrer">Open location map</a>
            <a className="inline-flex min-h-8 items-center font-semibold underline" href={CPD_SUBSTATION_DIRECTORY_URL} target="_blank" rel="noreferrer">City substation directory</a>
          </div>
        </div>}
        <label className="grid gap-1 text-sm font-semibold">Date and time · MM/DD/YYYY HH:MM<input disabled={!canEdit} value={dateTimeText} onChange={event=>setDateTimeText(formatDateTimeEntryMDY(event.target.value))} onKeyDown={event=>{if(event.key==='Enter'&&event.currentTarget.value.trim()==='?'){event.preventDefault();setDateTimeText(`${formatDateDMY(firstDay)} ${new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'})}`);}}} maxLength={16} placeholder="MM/DD/YYYY HH:MM" className="h-11 rounded border bg-card px-3 font-normal" data-testid="input-orientation-datetime"/></label>
      </div>
    </Panel>
    <Panel title={`Orientation checklist · ${checked} of ${SUBSTATION_ORIENTATION_KEYS.length} checked · ${checklistReviewed?'reviewed':'review required'}`} className="orientation-panel mt-4">
      <div className="orientation-checklist-tools flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">Prefilled checks are not confirmation. Clear non-applicable or incomplete items, then confirm your review.</p>
        <div className="flex flex-wrap gap-2">
          {canEdit&&<button type="button" onClick={()=>updateChecklist(checked===SUBSTATION_ORIENTATION_KEYS.length?Object.fromEntries(SUBSTATION_ORIENTATION_KEYS.map(key=>[key,false])):defaultSubstationOrientationChecklist())} className={`inline-flex min-h-11 items-center rounded border px-4 text-sm font-bold transition-colors hover:bg-muted ${checked===SUBSTATION_ORIENTATION_KEYS.length?'border-destructive/50 text-destructive':'border-primary/25'}`} data-testid="button-toggle-all-orientation">{checked===SUBSTATION_ORIENTATION_KEYS.length?'Deselect all':'Select all'}</button>}
          {canEdit&&<>
          <button type="button" onClick={confirmChecklistReview} disabled={checklistReviewed} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-confirm-orientation-review"><CheckCheck className="h-4 w-4"/>{checklistReviewed?'Review confirmed':'Confirm checklist review'}</button></>}
        </div>
      </div>
      <div className="orientation-progress" aria-label={`${checked} of ${SUBSTATION_ORIENTATION_KEYS.length} checklist items checked`}>
        <span style={{width:`${(checked/SUBSTATION_ORIENTATION_KEYS.length)*100}%`}}/>
      </div>
       <div className="grid gap-3 p-4">{SUBSTATION_ORIENTATION_SECTIONS.map((section,index)=><fieldset key={section.title} className="orientation-section rounded-md border bg-card p-4">
         <legend className="orientation-section-title mb-1 px-1"><span>{String(index+1).padStart(2,'0')}</span>{section.title}</legend>
         <p className="orientation-section-description mb-3 pl-1 text-sm text-muted-foreground">{section.description}</p>
         <div className="grid gap-2 sm:grid-cols-2">{section.items.map(([key,label])=><label key={key} className="orientation-check flex min-h-11 items-start gap-3 rounded border bg-card p-3 text-sm">
           <input type="checkbox" disabled={!canEdit} checked={record.checklist[key]!==false} onChange={event=>updateChecklist({...record.checklist,[key]:event.target.checked})} className="mt-0.5 h-5 w-5 shrink-0" data-testid={`checkbox-orientation-${key}`}/>{label}
        </label>)}</div>
      </fieldset>)}</div>
    </Panel>
    <Panel title="Directives, SOP, and narrative" className="orientation-panel mt-4">
      <div className="grid gap-4 p-4">
        <label className="grid gap-1 text-sm font-semibold">Division Directives / SOP reviewed (list)
          <input disabled={!canEdit} value={record.directivesReview} onChange={event=>update('directivesReview',event.target.value)} className="h-11 rounded border bg-card px-3 font-normal" data-testid="input-orientation-directives"/>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Narrative / continuation
          <textarea disabled={!canEdit} value={record.narrative} onChange={event=>update('narrative',event.target.value)} rows={8} className="min-h-40 rounded border bg-card p-3 text-sm font-normal" data-testid="input-orientation-narrative"/>
        </label>
      </div>
    </Panel>
    <div className="orientation-actions mt-4 flex flex-wrap items-center gap-3">
       {canEdit&&<button type="button" onClick={save} className="min-h-11 rounded bg-primary px-5 font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90" data-testid="button-save-orientation">Save and start shift</button>}
      <Link href="/reports/new" className="inline-flex min-h-11 items-center rounded border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted">Continue to shift forms</Link>
    </div>
     <PrintableSubstationOrientation record={record} pageReference={orientationPageReference} continuationPageReference={orientationContinuationPageReference}/>
  </div>;
}
