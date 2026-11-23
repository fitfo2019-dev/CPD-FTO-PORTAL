import * as React from 'react';
import { Panel } from '@/components/bits.js';
import { useWorkspace } from '@/state/workspace.js';
import { PHASE_LENGTH_WEEKS, phaseLabel, uid, type PhaseExtensionRequest } from '@/lib/model.js';
import { phaseExtensionRequestInputSchema } from '@/lib/phase-extension.js';
import { useToast } from '@/hooks/use-toast.js';

interface PhaseExtensionReviewViewProps {
  requests:readonly PhaseExtensionRequest[];
  vaultUnlocked:boolean;
  onReview(id:string,approve:boolean):Promise<void>;
}

export function PhaseExtensionReviewView({requests,vaultUnlocked,onReview}:PhaseExtensionReviewViewProps) {
  if(!requests.length)return null;
  return <Panel title={`Pending phase extension requests · ${requests.length}`} className="mb-4" id="panel-phase-extension-review">
    <ul className="divide-y">
      {requests.map(request=><li key={request.id} className="grid gap-3 p-4" data-testid={`phase-extension-request-${request.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold">{request.className} · {request.recruitName} #{request.recruitBadge}</p>
            <p className="text-sm text-muted-foreground">{phaseLabel(request.phase)} · {request.requestedWeeks} additional week{request.requestedWeeks===1?'':'s'} · {request.extensionType==='limbo_period'?'Limbo period':'Training phase'}</p>
            <p className="text-xs text-muted-foreground">Requested by {request.requestingFtoName} · #{request.requestingFtoBadge}</p>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleDateString()}</time>
        </div>
        <p className="whitespace-pre-wrap text-sm">{request.justification}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!vaultUnlocked} onClick={()=>void onReview(request.id,true)} className="min-h-10 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-approve-extension-${request.id}`}>Approve</button>
          <button type="button" disabled={!vaultUnlocked} onClick={()=>void onReview(request.id,false)} className="min-h-10 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid={`button-deny-extension-${request.id}`}>Deny</button>
        </div>
      </li>)}
    </ul>
    <p className="border-t px-4 py-3 text-xs text-muted-foreground">{vaultUnlocked?'This review is saved in the encrypted workspace on this device. It does not notify or sync to another device.':'Unlock this device’s encrypted workspace to approve or deny requests.'}</p>
  </Panel>;
}

export function PhaseExtensionPanel() {
  const {ws,vault,submitPhaseExtensionRequest,resolvePhaseExtensionRequest}=useWorkspace();
  const {toast}=useToast();
  const [extensionType,setExtensionType]=React.useState<PhaseExtensionRequest['extensionType']>('training_weeks');
  const [requestedWeeks,setRequestedWeeks]=React.useState(1);
  const [justification,setJustification]=React.useState('');
  const pending=ws.phaseExtensionRequests??[];

  async function reviewRequest(id:string,approve:boolean) {
    try {
      await resolvePhaseExtensionRequest(id,approve);
      toast(approve
        ?{title:'Extension approved',description:'The local phase timeline and saved reports have been updated.'}
        :{title:'Request denied',description:'The pending local request was removed.'});
    } catch {
      toast({title:'Request could not be saved',description:'The encrypted workspace could not be updated.',variant:'destructive'});
    }
  }

  if(ws.role==='fto_coordinator') {
    return <PhaseExtensionReviewView requests={pending} vaultUnlocked={vault==='unlocked'} onReview={reviewRequest}/>;
  }

  if(ws.role!=='fto'||!ws.caseFolder)return null;
  const folder=ws.caseFolder;
  const matchingPending=pending.filter(request=>request.recruitBadge.toLowerCase()===folder.recruitBadge.toLowerCase()
    &&request.phase===folder.phase&&(request.className??'').toLowerCase()===(folder.className??'').toLowerCase());

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid=phaseExtensionRequestInputSchema.safeParse({extensionType,requestedWeeks,justification});
    if(!valid.success)return;
    const request:PhaseExtensionRequest={
      id:uid(),className:folder.className??'',recruitName:folder.recruitName,recruitBadge:folder.recruitBadge,
      phase:folder.phase,phaseStartDate:folder.phaseStartDate,requestingFtoName:folder.ftoName,requestingFtoBadge:folder.ftoBadge,
      ...valid.data,createdAt:new Date().toISOString(),
    };
    try {
      await submitPhaseExtensionRequest(request);
      setJustification('');
      toast({title:'Extension request saved locally',description:'You can continue the phase paperwork while the request is pending.'});
    } catch {
      toast({title:'Request could not be saved',description:'The encrypted workspace could not be updated.',variant:'destructive'});
    }
  }

  return <Panel title="Request a phase extension" className="mb-4" id="panel-phase-extension-request">
    <form onSubmit={submit} className="grid gap-3 p-4">
      <p className="text-sm text-muted-foreground">{folder.className} · {folder.recruitName} #{folder.recruitBadge} · {phaseLabel(folder.phase)}. The standard duration is {PHASE_LENGTH_WEEKS[folder.phase]} weeks. A Coordinator must approve any requested extension.</p>
      <label className="grid gap-1 text-sm font-semibold">Extension type
        <select value={extensionType} onChange={event=>setExtensionType(event.target.value as PhaseExtensionRequest['extensionType'])} className="h-11 rounded border bg-card px-3" data-testid="select-extension-type">
          <option value="training_weeks">Additional training weeks</option>
          <option value="limbo_period">Limbo period extension</option>
        </select>
      </label>
      <label className="grid max-w-xs gap-1 text-sm font-semibold">Additional weeks
        <input type="number" min={1} step={1} value={requestedWeeks} onChange={event=>setRequestedWeeks(Number(event.target.value))} className="h-11 rounded border bg-card px-3" data-testid="input-extension-weeks"/>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Written justification
        <textarea required value={justification} onChange={event=>setJustification(event.target.value)} className="min-h-28 rounded border bg-card p-3 text-sm" data-testid="input-extension-justification"/>
      </label>
      {matchingPending.length>0&&<p role="status" className="rounded border bg-muted/40 p-3 text-sm">A request is pending. You can continue phase paperwork while it is reviewed.</p>}
      <button type="submit" disabled={vault!=='unlocked'||!justification.trim()||requestedWeeks<1||!Number.isInteger(requestedWeeks)||matchingPending.length>0} className="min-h-11 justify-self-start rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-submit-extension">Submit for Coordinator approval</button>
      <p className="text-xs text-muted-foreground">{vault==='unlocked'?'Requests are stored in this device’s encrypted workspace. The Coordinator must review them on this device.':'Unlock this device’s encrypted workspace before submitting a request.'}</p>
    </form>
  </Panel>;
}
