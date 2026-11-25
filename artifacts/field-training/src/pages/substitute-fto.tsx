import { useState } from 'react';
import { Link } from 'wouter';
import { CalendarClock, CircleAlert, ClipboardList, X } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { useToast } from '@/hooks/use-toast.js';
import { useWorkspace } from '@/state/workspace.js';
import { uid, type CoverageRequest } from '@/lib/model.js';
import { formatDateTimeEntryMDY, formatDateTimeMDY } from '@/lib/training-calendar.js';
import { parseRunDateTime } from '@/lib/run-details.js';
import { applyCurrentDateTimeShortcut } from '@/lib/date-time-shortcut.js';

const inputClass='min-h-11 w-full rounded border bg-card px-3 text-sm';

export default function SubstituteFtoPage() {
  const {ws,upsertCoverageRequest}=useWorkspace();
  const {toast}=useToast();
  const folder=ws.caseFolder;
  const [startText,setStartText]=useState('');
  const [endText,setEndText]=useState('');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const isFto=ws.role==='fto';
  const isCoordinator=ws.role==='fto_coordinator';
  const requests=[...(ws.coverageRequests??[])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  if(!isFto&&!isCoordinator) return <Panel title="FTO coverage"><p className="p-4 text-sm">This page is available to FTOs and the FTO Coordinator.</p></Panel>;

  function saveRequest() {
    setError('');
    if(!folder) {
      setError('Open a phase case folder first so the PO, class, phase, and FTO can be filled in.');
      return;
    }
    const start=parseRunDateTime(startText);
    const end=parseRunDateTime(endText);
    if(!start||!end) {
      setError('Enter both dates and times as MM/DD/YYYY HH:MM.');
      return;
    }
    if(new Date(end).getTime()<=new Date(start).getTime()) {
      setError('The end date and time must be after the start date and time.');
      return;
    }
    const now=new Date().toISOString();
    const request:CoverageRequest={
      id:uid(),
      assignmentId:folder.assignmentId,
      className:folder.className??'',
      phase:folder.phase,
      recruitName:folder.recruitName,
      recruitBadge:folder.recruitBadge,
      requestingFtoName:folder.ftoName,
      requestingFtoBadge:folder.ftoBadge,
      startDateTime:start,
      endDateTime:end,
      reason:reason.trim(),
      status:'local_unsent',
      createdAt:now,
      updatedAt:now,
    };
    upsertCoverageRequest(request);
    setStartText('');
    setEndText('');
    setReason('');
    toast({title:'Coverage request saved on this device',description:'No FTOs were notified.'});
  }

  function cancelLocalRequest(item:CoverageRequest) {
    upsertCoverageRequest({...item,status:'cancelled',updatedAt:new Date().toISOString()});
  }

  return <div className="mx-auto max-w-5xl">
    <PageHead kicker="FTO coverage" title={isCoordinator?'Coverage requests':'Request FTO coverage'}>
      <Link href="/fto-classes" className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-3 text-sm font-semibold"><CalendarClock className="h-4 w-4"/>Class and phase sign-up</Link>
    </PageHead>

    <div role="note" className="mb-4 flex items-start gap-3 rounded border-l-4 border-accent bg-accent/5 p-4 text-sm">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn"/>
      <div><b>Coverage request saved on this device only.</b><p className="mt-1 text-muted-foreground">Other FTOs are not notified and cannot accept or decline it here. Do not begin substitute work until a covering FTO has accepted and the Coordinator confirms the assignment.</p></div>
    </div>

    {isFto&&<Panel title="Request a substitute FTO" className="mb-5">
      {!folder?<div className="p-4 text-sm"><p>Open the PO’s phase folder first. The PO, class, phase, and requesting FTO will fill in automatically.</p><Link href="/phase-setup" className="mt-3 inline-flex min-h-10 items-center font-semibold underline">Open phase setup</Link></div>:
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded border bg-muted/30 p-3 text-sm"><span className="label-caps">Probationary Officer</span><p className="mt-1 break-words font-semibold">{folder.recruitName} · #{folder.recruitBadge}</p></div>
        <div className="rounded border bg-muted/30 p-3 text-sm"><span className="label-caps">Class and phase</span><p className="mt-1 break-words font-semibold">{folder.className} · Phase {folder.phase}</p></div>
        <div className="rounded border bg-muted/30 p-3 text-sm sm:col-span-2"><span className="label-caps">Requesting FTO</span><p className="mt-1 break-words font-semibold">{folder.ftoName} · #{folder.ftoBadge}</p></div>
        <label className="grid gap-1 text-sm font-semibold">Coverage starts · MM/DD/YYYY HH:MM
          <input className={inputClass} inputMode="text" placeholder="MM/DD/YYYY HH:MM" maxLength={16} value={startText} onChange={event=>setStartText(formatDateTimeEntryMDY(event.target.value))} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setStartText)} data-testid="input-coverage-start"/>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Coverage ends · MM/DD/YYYY HH:MM
          <input className={inputClass} inputMode="text" placeholder="MM/DD/YYYY HH:MM" maxLength={16} value={endText} onChange={event=>setEndText(formatDateTimeEntryMDY(event.target.value))} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setEndText)} data-testid="input-coverage-end"/>
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Reason or scheduling note
          <textarea className="min-h-24 rounded border bg-card p-3 text-sm font-normal" maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Add a short note for the FTO team." data-testid="input-coverage-reason"/>
        </label>
        {error&&<p role="alert" className="text-sm font-semibold text-destructive sm:col-span-2">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="button" onClick={saveRequest} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid="button-save-coverage-request"><CalendarClock className="h-4 w-4"/>Save request locally</button>
          <span className="text-xs text-muted-foreground">Saving does not notify another account or create a substitute daily form.</span>
        </div>
      </div>}
    </Panel>}

    {isCoordinator&&<Panel title="Incoming coverage responses" className="mb-5">
      <div className="p-4 text-sm" role="status" data-testid="coverage-response-unavailable">
        <p className="font-semibold">Accepting or declining shared requests is unavailable.</p>
        <p className="mt-1 text-muted-foreground">A request must be delivered to the FTO team before anyone can respond. No response buttons are shown for requests that have not been sent.</p>
      </div>
    </Panel>}

    <Panel title={isCoordinator?'Local coverage requests':'My coverage requests'}>
      {requests.length===0?<p className="p-4 text-sm text-muted-foreground">{isCoordinator?'No local requests are saved on this device.':'You have no saved coverage request drafts.'}</p>:
      <ul className="divide-y">{requests.map(item=><li key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" data-testid={`coverage-request-${item.id}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><b className="break-words">{item.recruitName} · #{item.recruitBadge}</b><span className="rounded border px-2 py-0.5 text-xs font-semibold">{item.status==='cancelled'?'Cancelled':'Not sent'}</span></div>
          <p className="mt-1 text-sm text-muted-foreground">{item.className} · Phase {item.phase} · requested by {item.requestingFtoName} #{item.requestingFtoBadge}</p>
          <p className="mt-1 text-sm"><b>From:</b> {formatDateTime(item.startDateTime)} <b className="ml-2">To:</b> {formatDateTime(item.endDateTime)}</p>
          {item.reason&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.reason}</p>}
          <p className="mt-2 text-xs text-muted-foreground">This request has not been sent to other accounts. No substitute work can be started from it.</p>
        </div>
        {isFto&&item.status==='local_unsent'&&<button type="button" onClick={()=>cancelLocalRequest(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold" data-testid={`button-cancel-coverage-${item.id}`}><X className="h-4 w-4"/>Cancel local draft</button>}
      </li>)}</ul>}
    </Panel>
  </div>;
}

function formatDateTime(value:string) {
  return formatDateTimeMDY(value)||'—';
}
