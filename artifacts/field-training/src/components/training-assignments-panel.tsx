import { useMemo, useState, type ChangeEvent } from 'react';
import { Download, Mail, Upload } from 'lucide-react';
import { Panel } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { useToast } from '@/hooks/use-toast.js';
import { useWorkspace } from '@/state/workspace.js';
import { phaseAssignmentLabel, phaseLabel, uid, type PhaseCaseFolder, type Shift, type TrainingAssignment } from '@/lib/model.js';
import { cruiserDistrictForFtoAssignment, isValidFtoAssignment } from '@/lib/cpd-geography.js';
import { formatDateDMY, requiredDaysOff } from '@/lib/training-calendar.js';
import { parseRosterFile, ROSTER_CSV_TEMPLATE, type ParsedRoster } from '@/lib/assignment-import.js';
import { operatorErrorMessage, reportUnexpectedOperatorError } from '@/lib/operator-errors.js';

export function TrainingAssignmentsPanel({ onLoadAssignment }: { onLoadAssignment: (assignment: TrainingAssignment) => void }) {
  const { ws, vault, importRoster, upsertAssignment } = useWorkspace();
  const { toast } = useToast();
  const [fileName,setFileName]=useState('');
  const [preview,setPreview]=useState<ParsedRoster|null>(null);
  const [parseError,setParseError]=useState('');
  const [busy,setBusy]=useState(false);
  const isCoordinator=ws.role==='fto_coordinator';
  const classCount=new Set(ws.assignments.map(item=>item.className)).size;
  const sortedAssignments=[...ws.assignments].sort((a,b)=>a.className.localeCompare(b.className)||a.recruitName.localeCompare(b.recruitName));
  const templateHeaders=ROSTER_CSV_TEMPLATE.split('\n')[0];
  const ftoByBadge=useMemo(()=>new Map(ws.ftoDirectory.map(fto=>[fto.badge.toLowerCase(),fto])),[ws.ftoDirectory]);

  if (!isCoordinator) return null;

  async function onFileChange(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];
    if (!file) return;
    setBusy(true);setFileName(file.name);setPreview(null);setParseError('');
    try { setPreview(await parseRosterFile(file)); }
    catch (error) {
      reportUnexpectedOperatorError(error,'Could not read a roster file');
      setParseError(operatorErrorMessage(error,'Could not read this file. Check that it is a supported roster and try again.'));
    }
    finally { setBusy(false);event.target.value=''; }
  }

  function addRoster() {
    if (!preview || preview.errors.length) return;
    const assignments=preview.assignments.map(item=>({...item,id:uid()}));
    importRoster(preview.ftos,assignments);
    toast({title:'Roster added on this device',description:`${preview.ftos.length} unique FTOs and ${assignments.length} PO assignments. It is not shared with other accounts.${vault==='unlocked'?' Encrypted save is in progress.':' Save locally before leaving to keep it.'}`});
    setPreview(null);setFileName('');
  }

  function downloadTemplate() {
    const url=URL.createObjectURL(new Blob([ROSTER_CSV_TEMPLATE],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='Columbus_FTO_Portal_roster_template.csv';link.click();URL.revokeObjectURL(url);
  }

  function changeAssignedFto(assignment:TrainingAssignment,badge:string) {
    if (!badge) return;
    upsertAssignment({...assignment,ftoBadge:badge});
  }

  return <Panel title="FTO Coordinator · roster and phase assignments" className="mb-4" data-testid="panel-training-assignments">
    <div className="p-4">
      <div className="mb-3 rounded border border-warn/40 bg-warn/10 p-3 text-sm" role="status">
        <b>Roster changes are saved on this device only.</b> Importing a roster does not activate Phase I, invite POs, confirm roles, or make the roster official. Ask FTO Office Admin to complete class activation.
      </div>
      <p className="text-sm text-muted-foreground">Upload one row per PO assignment. Repeating an FTO in the file builds a unique badge-number directory automatically. Rows with PO fields blank add an FTO only. Names remain on this device and are not uploaded.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={downloadTemplate} className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-4 text-sm font-semibold"><Download className="h-4 w-4"/>Download CSV template</button>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground">
          <Upload className="h-4 w-4"/>{busy?'Reading file…':'Choose CSV or Word file'}
          <input type="file" accept=".csv,.xlsx,.docx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFileChange} disabled={busy} className="sr-only" data-testid="input-roster-file"/>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Accepted: .csv or Word .docx with a table and a header row. Maximum 2 MB. Required assignment fields: class, PO name/badge, FTO name/badge, and phase start date (MM/DD/YYYY). Phase defaults to Phase I when omitted. Shift, days off, emails, and patrol assignment may also be included. For 80C-1 or 80C-2, include Zone, Precinct, Shift, and the actual mapped Cruiser District.</p>
      <p className="mt-1 break-all text-xs text-muted-foreground" data-testid="text-roster-columns">Columns: {templateHeaders}</p>
      {parseError&&<p className="mt-3 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{parseError}</p>}
      {preview&&<div className="mt-3 rounded border bg-muted/30 p-3" data-testid="roster-import-preview">
        <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">Preview · {fileName}</b><span className="text-xs">{preview.sourceRows} rows · {preview.ftos.length} unique FTOs · {preview.assignments.length} PO assignments</span></div>
        {preview.errors.length>0&&<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">{preview.errors.map((item,index)=><li key={index}>{item}</li>)}</ul>}
        {preview.warnings.map((item,index)=><p className="mt-2 text-sm text-warn" key={index}>{item}</p>)}
        {preview.assignments.length>0&&<div className="mt-3 max-h-56 overflow-auto rounded border bg-card">
          <table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-muted"><tr><th className="p-2">Class / phase</th><th className="p-2">PO</th><th className="p-2">FTO</th><th className="p-2">Start date</th><th className="p-2">Shift / days off</th><th className="p-2">Patrol area / assignment</th></tr></thead>
          <tbody>{preview.assignments.slice(0,50).map((item,index)=><tr key={index} className="border-t"><td className="p-2">{item.className} · {phaseLabel(item.phase)}</td><td className="p-2">{item.recruitName} · {item.recruitBadge}</td><td className="p-2">{preview.ftos.find(fto=>fto.badge===item.ftoBadge)?.name} · {item.ftoBadge}</td><td className="p-2">{formatDateDMY(item.phaseStartDate)}</td><td className="p-2">{item.shift ?? 'Set later'} · {item.daysOff?.length?item.daysOff.join(', '):'days off not set'}</td><td className="p-2">{item.zone&&item.precinct?`Zone ${item.zone} · Precinct ${item.precinct}`:'Area not set'}{item.ftoAssignment?` · ${phaseAssignmentLabel(item.ftoAssignment,item.shift,item.cruiserDistrict)}`:''}</td></tr>)}</tbody></table>
          {preview.assignments.length>50&&<p className="p-2 text-xs text-muted-foreground">Showing the first 50 assignments; all valid rows are included when added.</p>}
        </div>}
        <button type="button" disabled={preview.errors.length>0||preview.ftos.length===0} onClick={addRoster} className="mt-3 min-h-11 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-add-roster">Add roster to this device</button>
      </div>}
    </div>

    <div className="grid grid-cols-2 gap-2 border-y bg-muted/20 p-4 sm:grid-cols-3">
      <div className="rounded border bg-card p-3"><span className="text-xs text-muted-foreground">Training classes</span><b className="block text-xl">{classCount}</b></div>
      <div className="rounded border bg-card p-3"><span className="text-xs text-muted-foreground">Unique FTOs</span><b className="block text-xl">{ws.ftoDirectory.length}</b></div>
      <div className="rounded border bg-card p-3"><span className="text-xs text-muted-foreground">PO assignments</span><b className="block text-xl">{ws.assignments.length}</b></div>
    </div>
    <section className="p-4" aria-labelledby="fto-directory-heading">
      <h3 id="fto-directory-heading" className="font-bold">FTO directory · all badge numbers</h3>
      {ws.ftoDirectory.length===0?<p className="mt-2 text-sm text-muted-foreground">Upload a roster to build the FTO list in one import.</p>:
      <ul className="mt-2 flex flex-wrap gap-2">{ws.ftoDirectory.map(fto=><li key={fto.badge} className="rounded border bg-card px-3 py-2 text-sm"><b>{fto.name}</b> · Badge {fto.badge}{fto.email&&<span className="block break-all text-xs text-muted-foreground">{fto.email}</span>}</li>)}</ul>}
    </section>
    <section className="border-t p-4" aria-labelledby="phase-assignments-heading">
      <h3 id="phase-assignments-heading" className="font-bold">PO assignments</h3>
      {sortedAssignments.length===0?<p className="mt-2 text-sm text-muted-foreground">No imported assignments yet.</p>:
      <div className="mt-3 space-y-3">{sortedAssignments.map(assignment=>{
        const assignedFto=ftoByBadge.get(assignment.ftoBadge.toLowerCase());
        const offDays=assignment.daysOff?.length?assignment.daysOff.map(day=>['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]).join(', '):'Set by FTO when opening case folder';
        const district=assignment.cruiserDistrict??(assignment.ftoAssignment&&assignment.shift
          ?cruiserDistrictForFtoAssignment(assignment.zone??'',assignment.precinct??'',assignment.ftoAssignment,assignment.shift)
          :undefined);
        const ftoAssignment=phaseAssignmentLabel(assignment.ftoAssignment,assignment.shift);
        const emailBody=[
          `Hello ${assignment.recruitName} and ${assignedFto?.name ?? 'FTO'},`,
          '',
          'This field-training assignment notice was drafted on this device.',
          `Class: ${assignment.className}`,
          `Probationary Officer: ${assignment.recruitName} · Badge ${assignment.recruitBadge}`,
          `Field Training Officer: ${assignedFto?.name ?? 'Unassigned'} · Badge ${assignment.ftoBadge}`,
          `Phase: ${phaseLabel(assignment.phase)}`,
          `Start date: ${formatDateDMY(assignment.phaseStartDate)}`,
          `Shift: ${assignment.shift||'to be confirmed in the case folder'}`,
          ...(assignment.zone&&assignment.precinct?[`Patrol area: Zone ${assignment.zone} · Precinct ${assignment.precinct}${district?` · Cruiser district ${district}`:''}`]:[]),
          `Days off: ${assignment.daysOff?.length?offDays:'to be selected by the FTO'}`,
          ...(assignment.ftoAssignment?[`FTO assignment: ${ftoAssignment}`]:[]),
          '',
          'Please coordinate any schedule or assignment questions directly.',
        ].join('\n');
        const emailHref=assignment.recruitEmail&&assignedFto?.email?`mailto:${encodeURIComponent(assignment.recruitEmail)}?${new URLSearchParams({subject:`Field training assignment · ${assignment.className}`,body:emailBody,cc:assignedFto.email}).toString()}`:undefined;
        const canActivate=!!assignment.shift&&(assignment.daysOff?.length??0)===requiredDaysOff(assignment.shift)&&!!assignment.zone&&!!assignment.precinct&&!!district&&!!assignment.ftoAssignment&&isValidFtoAssignment(assignment.zone,assignment.precinct,assignment.ftoAssignment,assignment.shift,district);
        return <article key={assignment.id} className="min-w-0 rounded border bg-card p-3" data-testid={`assignment-${assignment.id}`}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.7fr)]">
            <div className="min-w-0">
              <div className="break-words font-semibold">{assignment.className} · {phaseLabel(assignment.phase)}</div>
              <div className="mt-1 break-words text-sm">{assignment.recruitName} · PO badge {assignment.recruitBadge}</div>
              <div className="text-sm">Start date: {formatDateDMY(assignment.phaseStartDate)}</div>
              <div className="text-xs text-muted-foreground">PO email: {assignment.recruitEmail||'not provided'} · Shift: {assignment.shift||'not set'} · Days off: {offDays}</div>
              {assignment.zone&&assignment.precinct&&<div className="text-xs text-muted-foreground">Patrol area: Zone {assignment.zone} · Precinct {assignment.precinct}{district?` · Cruiser district ${district}`:''}</div>}
              <div className="mt-2 text-xs text-muted-foreground">FTO assignment: {assignment.ftoAssignment?ftoAssignment:'Complete in the phase case folder'}</div>
            </div>
            <label className="min-w-0 space-y-1 text-xs font-semibold">Assigned FTO
              <SearchableSelect className="h-11 w-full min-w-0 rounded border bg-background px-3 text-sm" value={assignment.ftoBadge} onChange={event=>changeAssignedFto(assignment,event.target.value)} data-testid={`select-assigned-fto-${assignment.id}`}>
                {ws.ftoDirectory.map(fto=><option key={fto.badge} value={fto.badge}>{fto.name} · {fto.badge}</option>)}
              </SearchableSelect>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={()=>onLoadAssignment(assignment)} className="min-h-11 rounded border bg-card px-3 text-sm font-semibold" data-testid={`button-load-assignment-${assignment.id}`}>Prefill phase case folder</button>
            {emailHref?<a href={emailHref} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground" data-testid={`link-email-assignment-${assignment.id}`}><Mail className="h-4 w-4"/>Open prefilled email</a>:
              <span className="flex min-h-11 items-center rounded border px-3 text-xs text-muted-foreground">Add both PO and FTO emails to enable the email draft</span>}
            {!canActivate&&<span className="flex min-h-11 items-center text-xs text-muted-foreground">FTO selects shift days off and confirms patrol area when opening the folder.</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The button opens a draft in your email app. Check the recipient and message, then send it from there.</p>
        </article>;
      })}</div>}
    </section>
  </Panel>;
}

export type PrefilledCaseFolder = Omit<PhaseCaseFolder,'openedAt'|'shift'> & {shift:Shift|''};
export function assignmentToCaseFolder(assignment:TrainingAssignment,ftos:{badge:string;name:string}[]):PrefilledCaseFolder {
  const fto=ftos.find(item=>item.badge.toLowerCase()===assignment.ftoBadge.toLowerCase());
  return {
    assignmentId:assignment.id,className:assignment.className,recruitName:assignment.recruitName,recruitBadge:assignment.recruitBadge,
    ftoName:fto?.name??'',ftoBadge:fto?.badge??assignment.ftoBadge,phase:assignment.phase,shift:assignment.shift??'',
    phaseStartDate:assignment.phaseStartDate,daysOff:assignment.daysOff??[],
    zone:assignment.zone??'',precinct:assignment.precinct??'',
    cruiserDistrict:assignment.cruiserDistrict??cruiserDistrictForFtoAssignment(assignment.zone??'',assignment.precinct??'',assignment.ftoAssignment??'',assignment.shift??'')??'',
    ftoAssignment:assignment.ftoAssignment??'',
  };
}
