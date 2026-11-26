import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CheckCheck, Printer } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { PrintableSubstationOrientation } from '@/components/printable-extended-forms.js';
import { useToast } from '@/hooks/use-toast.js';
import { uid, type SubstationOrientationRecord } from '@/lib/model.js';
import { SUBSTATION_ORIENTATION_CATEGORIES, SUBSTATION_ORIENTATION_KEYS, defaultSubstationOrientationChecklist, orientationGroupState, setOrientationGroup, type SubstationOrientationKey } from '@/lib/substation-orientation.js';
import { orientationPrintLayout } from '@/lib/orientation-print-layout.js';
import { CPD_SUBSTATION_DIRECTORY_URL, getSubstation } from '@/lib/substations.js';
import { applyCurrentDateTimeShortcut } from '@/lib/date-time-shortcut.js';
import { formatDateDMY, formatDateTimeMDY, formatDateTimeEntryMDY, formatTrainingFolderPageReference, getNextReportDate, getTrainingFolderDayReference, parseDateDMY, splitDateTimeEntryMDY } from '@/lib/training-calendar.js';
import { parseRunDateTime } from '@/lib/run-details.js';
import { useWorkspace } from '@/state/workspace.js';
import { resolveOperationalPacket } from '@/lib/operational-state-machine.js';
import { savedOrientationContext } from '@/lib/saved-orientation.js';

export default function SubstationOrientationPage() {
  const {ws,vault,upsertSubstationOrientation,previewOnly}=useWorkspace();
  const [,navigate]=useLocation();
  const {toast}=useToast();
  useEffect(()=>{
    document.body.classList.add('print-substation-route');
    return()=>document.body.classList.remove('print-substation-route');
  },[]);
  const search=useSearch();
  const savedId=new URLSearchParams(search).get('orientation');
  const savedContext=savedId!==null
    ?savedOrientationContext(savedId,[...(ws.caseFolder?[ws.caseFolder]:[]),...ws.phaseFolders],ws.substationOrientations)
    :undefined;
  const folder=savedId!==null?savedContext?.folder:ws.caseFolder;
  const canAccess=ws.role==='fto'||ws.role==='fto_coordinator';
  const canEdit=ws.role==='fto';
  const firstDay=folder ? getNextReportDate(folder,[]) : '';
  const orientationDayReference=folder&&firstDay
    ?getTrainingFolderDayReference(folder.phase,firstDay,folder.phaseStartDate,folder.daysOff)
    :undefined;
  const orientationPageReference=formatTrainingFolderPageReference(orientationDayReference,2);
  const existing=savedId!==null?savedContext?.existing:folder ? ws.substationOrientations.find(item=>item.recruitBadge===folder.recruitBadge&&item.className===folder.className&&item.phaseStartDate===firstDay&&(item.phase??1)===folder.phase) : undefined;
  const initial=useMemo<SubstationOrientationRecord|null>(()=>folder?existing
    ?{...existing,phase:existing.phase??folder.phase}
    :{
      id:uid(),className:folder.className??'',recruitName:folder.recruitName,recruitBadge:folder.recruitBadge,
      ftoName:folder.ftoName,ftoBadge:folder.ftoBadge,phase:folder.phase,phaseStartDate:firstDay,dateTime:'',substation:'',
      checklist:defaultSubstationOrientationChecklist(),checklistReviewedAt:undefined,directivesReview:'',narrative:'',updatedAt:new Date().toISOString(),
    }:null,[folder,existing,firstDay]);
  const [record,setRecord]=useState<SubstationOrientationRecord|null>(initial);
  const [substationText,setSubstationText]=useState(initial?.substation??'');
  const [substationError,setSubstationError]=useState('');
  const [dateTimeText,setDateTimeText]=useState(initial?.dateTime?formatDateTimeMDY(initial.dateTime):firstDay?`${formatDateDMY(firstDay)} `:'');
  useEffect(()=>{
    setRecord(initial);
    setSubstationText(initial?.substation??'');
    setSubstationError('');
    setDateTimeText(initial?.dateTime?formatDateTimeMDY(initial.dateTime):firstDay?`${formatDateDMY(firstDay)} `:'');
  },[initial,firstDay]);
  const continuationCount=record?orientationPrintLayout(record).continuations.length:0;
  // P2 belongs to Reporting for Duty. Only a saved first-day report can place overflow after its runs.
  const firstDayReport=folder?ws.reports.find(item=>item.date===firstDay&&item.phase===folder.phase&&item.recruitBadge===folder.recruitBadge&&(item.className??'')===(folder.className??'')):undefined;
  const continuationReferences:(string|undefined)[]=(()=>{
    if(!record||!folder||!firstDayReport||continuationCount===0) return Array.from({length:continuationCount},()=>undefined);
    const packet=resolveOperationalPacket(firstDayReport,[...ws.phaseFolders,...(ws.phaseFolders.includes(folder)?[]:[folder])],[record]);
    const refs=packet.pages.filter(page=>page.kind==='orientation_continuation').map(page=>page.reference);
    return Array.from({length:continuationCount},(_,index)=>refs[index]);
  })();
  const totalCategories=SUBSTATION_ORIENTATION_CATEGORIES.length;
  const coveredCategories=record?SUBSTATION_ORIENTATION_CATEGORIES.filter(category=>orientationGroupState(record.checklist,category.keys).checked).length:0;
  const checked=SUBSTATION_ORIENTATION_KEYS.filter(key=>record?.checklist[key]!==false).length;
  const selectedSubstation=getSubstation(record?.substation??'');
  if(!canAccess) return <Panel title="Substation Orientation access"><p className="p-4">This form is available to FTO’s and the FTO Coordinator.</p></Panel>;
  if(!folder||!record) return <Panel title="Substation Orientation"><div className="p-4 text-sm"><p>Open the active phase case folder to prefill the PO and FTO before completing this first-day form.</p><Link href="/phase-setup" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Open Phase Setup</Link></div></Panel>;
  if(ws.role==='fto_coordinator'&&!existing) return <Panel title="Substation Orientation"><p className="p-4 text-sm">No saved orientation record is available to review. The assigned FTO completes this first-day form.</p></Panel>;

  const update=<K extends keyof SubstationOrientationRecord>(key:K,value:SubstationOrientationRecord[K])=>setRecord(current=>current?{...current,[key]:value,checklistReviewedAt:undefined,updatedAt:new Date().toISOString()}:current);
  const updateChecklist=(checklist:Record<string,boolean>)=>setRecord(current=>current?{...current,checklist,checklistReviewedAt:undefined,updatedAt:new Date().toISOString()}:current);
  const toggleGroup=(keys:readonly SubstationOrientationKey[],value:boolean)=>setRecord(current=>current?{...current,checklist:setOrientationGroup(current.checklist,keys,value),checklistReviewedAt:undefined,updatedAt:new Date().toISOString()}:current);
  const confirmChecklistReview=()=>setRecord(current=>current?{...current,checklistReviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:current);
  const commitSubstation=()=>{
    if(!canEdit) return record.substation;
    const station=getSubstation(substationText);
    if(substationText.trim()&&!station){setSubstationError('Enter a valid substation number from 1 to 20.');return undefined;}
    const value=station?.id??'';
    setSubstationText(value);
    setSubstationError('');
    if(value!==record.substation) update('substation',value);
    return value;
  };
  const save=()=>{
    const substation=commitSubstation();
    if(substation===undefined) return;
    if(!record.checklistReviewedAt){toast({title:'Review the orientation checklist',description:'Keep checked only the items completed during the walkthrough, clear the rest, then confirm the review.',variant:'destructive'});return;}
    const dateTime=parseRunDateTime(dateTimeText);
    if(!dateTime){toast({title:'Enter the date and time',description:'Use MM/DD/YYYY HH:MM for the first training day.',variant:'destructive'});return;}
    if(parseDateDMY(splitDateTimeEntryMDY(dateTimeText).date)!==firstDay){
      toast({title:'Use the first scheduled training day',description:`This form is marked for ${formatDateDMY(firstDay)}.`,variant:'destructive'});return;
    }
     const saved={...record,substation,dateTime,phase:folder.phase,phaseStartDate:firstDay,updatedAt:new Date().toISOString()};
    upsertSubstationOrientation(saved);setRecord(saved);
      toast({
        title:previewOnly?'Orientation saved in test preview':'Phase orientation saved on this device',
        description:previewOnly
          ? 'This temporary test entry will clear when the preview refreshes. The shift form is opening next.'
          : vault==='unlocked'
            ? 'Encrypted local autosave is in progress. The shift form is opening next.'
            : 'It is only in memory until you open the local vault and save this device workspace.',
      });
     navigate('/reports/new');
  };
  const checklistReviewed=!!record.checklistReviewedAt;
  return <div className="orientation-page mx-auto max-w-5xl">
     <PageHead kicker={`Phase ${folder.phase} · first scheduled day`} title="Substation Orientation · U-10.181">
      <button type="button" onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded border border-primary/25 bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted" data-testid="button-print-orientation"><Printer className="h-4 w-4"/>Print / PDF</button>
    </PageHead>
    <div className="orientation-guidance mb-4 rounded border p-3 text-sm">
        Complete this before the first shift of each phase. The form is dated for the phase’s first scheduled workday. Every checklist item starts checked for quick review; clear anything not completed during the walkthrough, then confirm the review before saving. {previewOnly?'Test values remain in memory and clear when the preview refreshes.':'Values stay in this device’s local workspace.'}
    </div>
    {!canEdit&&<div className="mb-4 rounded border bg-muted/30 p-3 text-sm">FTO Coordinator view is read-only. The assigned FTO completes and saves this orientation.</div>}
    <Panel title="PO, FTO, substation, and date" className="orientation-panel">
      <div className="orientation-fields grid gap-3 p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Probationary Officer<input value={`${record.recruitName} · ${record.recruitBadge}`} readOnly className="h-11 rounded border bg-muted px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-semibold">Field Training Officer<input value={`${record.ftoName} · ${record.ftoBadge}`} readOnly className="h-11 rounded border bg-muted px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-semibold">Substation
          <input disabled={!canEdit} value={substationText} inputMode="numeric" onChange={event=>{setSubstationText(event.target.value);setSubstationError('');if(record.substation)update('substation','');}} onBlur={commitSubstation} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commitSubstation();}}} aria-invalid={!!substationError} aria-describedby="orientation-substation-help" className="h-11 w-full rounded border bg-card px-3 font-normal" data-testid="input-orientation-substation"/>
          <span id="orientation-substation-help" className={`text-xs font-normal ${substationError?'text-destructive':'text-muted-foreground'}`}>{substationError||'Enter the substation number, then press Tab or Enter to show its details.'}</span>
        </label>
        <label className="orientation-field grid gap-1 text-sm font-semibold">Date and time · MM/DD/YYYY HH:MM<input disabled={!canEdit} value={dateTimeText} onChange={event=>setDateTimeText(formatDateTimeEntryMDY(event.target.value))} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setDateTimeText,formatDateDMY(firstDay))} maxLength={16} placeholder="MM/DD/YYYY HH:MM" className="h-11 rounded border bg-card px-3 font-normal" data-testid="input-orientation-datetime"/><span className="text-xs font-normal text-muted-foreground">Enter ? then press Tab for the current date and time. Saving still requires the first scheduled training day.</span></label>
        {selectedSubstation&&<div className="orientation-location rounded border bg-muted/30 p-3 text-sm sm:col-span-2" data-testid="substation-location-details">
          <p className="font-semibold">Substation {selectedSubstation.id}</p>
          <p>{selectedSubstation.address}, {selectedSubstation.city} {selectedSubstation.zip} · {selectedSubstation.phone}</p>
          <div className="mt-1 flex flex-wrap gap-x-4">
            <a className="inline-flex min-h-8 items-center font-semibold underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedSubstation.address}, ${selectedSubstation.city} ${selectedSubstation.zip}`)}`} target="_blank" rel="noreferrer">Open location map</a>
            <a className="inline-flex min-h-8 items-center font-semibold underline" href={CPD_SUBSTATION_DIRECTORY_URL} target="_blank" rel="noreferrer">City substation directory</a>
          </div>
        </div>}
      </div>
    </Panel>
    <Panel title={`Walkthrough checklist · ${checked} of ${SUBSTATION_ORIENTATION_KEYS.length} original tasks covered · ${coveredCategories} of ${totalCategories} categories · ${checklistReviewed?'reviewed':'review required'}`} className="orientation-panel mt-4">
      <div className="orientation-checklist-tools flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">FTO / PO walkthrough record, not a performance rating. Check a category only when every listed task was covered; a dashed box means some of its tasks are still open.</p>
        {canEdit&&<button type="button" onClick={()=>updateChecklist(checked===SUBSTATION_ORIENTATION_KEYS.length?Object.fromEntries(SUBSTATION_ORIENTATION_KEYS.map(key=>[key,false])):defaultSubstationOrientationChecklist())} className={`inline-flex min-h-11 items-center rounded border px-4 text-sm font-bold transition-colors hover:bg-muted ${checked===SUBSTATION_ORIENTATION_KEYS.length?'border-destructive/50 text-destructive':'border-primary/25'}`} data-testid="button-toggle-all-orientation">{checked===SUBSTATION_ORIENTATION_KEYS.length?'Deselect all':'Select all'}</button>}
      </div>
      <div className="orientation-category-grid grid gap-2 p-3 sm:grid-cols-2" role="group" aria-label="Walkthrough checklist categories">{SUBSTATION_ORIENTATION_CATEGORIES.map(category=><GroupCheck key={category.id} id={category.id} keys={category.keys} label={category.label} categoryName={category.categoryName} checklist={record.checklist} disabled={!canEdit} onToggle={toggleGroup}/>)}</div>
      <div className="orientation-review-bar flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm" data-testid="text-orientation-review-status">{checklistReviewed?'Review confirmed. Any further edit clears this confirmation.':'After walking through every category with the PO, confirm the review below the list.'}</p>
        {canEdit&&<button type="button" onClick={confirmChecklistReview} disabled={checklistReviewed} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-confirm-orientation-review"><CheckCheck className="h-4 w-4"/>{checklistReviewed?'Review confirmed':'Confirm checklist review'}</button>}
      </div>
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
     <PrintableSubstationOrientation record={record} pageReference={orientationPageReference} continuationReferences={continuationReferences}/>
  </div>;
}

function GroupCheck({id,keys,label,categoryName,checklist,disabled,onToggle}:{id:string;keys:readonly SubstationOrientationKey[];label:string;categoryName:string;checklist:Record<string,boolean>;disabled:boolean;onToggle:(keys:readonly SubstationOrientationKey[],value:boolean)=>void}) {
  const state=orientationGroupState(checklist,keys);
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(ref.current) ref.current.indeterminate=state.indeterminate;},[state.indeterminate]);
  const covered=keys.filter(key=>checklist[key]!==false).length;
  const labels=label.split('; ');
  const headingId=`orientation-${id}-name`;
  const detailsId=`orientation-${id}-details`;
  return <label className={`orientation-check flex items-start gap-3 rounded border bg-card text-sm${state.indeterminate?' is-mixed':''}`} data-testid={`row-orientation-${id}`}>
    <input ref={ref} type="checkbox" disabled={disabled} checked={state.checked} aria-checked={state.indeterminate?'mixed':state.checked} aria-labelledby={headingId} aria-describedby={detailsId} onChange={event=>onToggle(keys,event.target.checked)} className="orientation-check-input h-5 w-5 shrink-0" data-testid={`checkbox-orientation-${id}`}/>
    <span className="orientation-check-body">
      <span id={headingId} className="orientation-check-name">{categoryName}</span>
      <span id={detailsId} className="orientation-check-details">
        <ul className="orientation-check-tasks">{labels.map(item=><li key={item}>{item}</li>)}</ul>
        <span className="orientation-check-count">{covered} of {keys.length} {keys.length===1?'task':'tasks'} covered</span>
      </span>
    </span>
  </label>;
}
