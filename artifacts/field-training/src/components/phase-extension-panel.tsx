import * as React from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'wouter';
import { Panel } from '@/components/bits.js';
import { useWorkspace } from '@/state/workspace.js';
import { PHASE_LENGTH_WEEKS, phaseLabel, type PhaseExtensionRequest } from '@/lib/model.js';
import { phaseExtensionRequestInputSchema } from '@/lib/phase-extension.js';
import { listSharedPhaseExtensionRequests, PhaseExtensionApiError, reviewSharedPhaseExtensionRequest, submitSharedPhaseExtensionRequest } from '@/lib/phase-extension-api.js';
import { useToast } from '@/hooks/use-toast.js';
import { operatorErrorMessage, operatorErrorToast, reportUnexpectedOperatorError } from '@/lib/operator-errors.js';

interface PhaseExtensionReviewViewProps {
  requests:readonly PhaseExtensionRequest[];
  onReview(id:string,approve:boolean,denialExplanation?:string):Promise<void>;
  reviewingId?:string;
  loading?:boolean;
  error?:string|null;
  previewOnly?:boolean;
}

export function PhaseExtensionReviewView({requests,onReview,reviewingId,loading,error,previewOnly=false}:PhaseExtensionReviewViewProps) {
  return <Panel title={`Phase extension requests · ${requests.length}`} className="mb-4" id="panel-phase-extension-review">
    {error&&<p role="alert" className="border-b bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {previewOnly&&<p role="status" className="border-b bg-amber-50 p-4 text-sm text-amber-950">Fictional request shown for preview only. Review actions and shared-service access are disabled.</p>}
    {loading&&<p role="status" className="border-b p-4 text-sm text-muted-foreground">Loading shared requests…</p>}
    {!loading&&!error&&!requests.length&&<p className="p-4 text-sm text-muted-foreground">No phase extension requests are available.</p>}
    {!!requests.length&&<ul className="divide-y">
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
        {request.status==='denied'&&request.denialExplanation&&<div className="rounded border bg-muted/40 p-3" data-testid={`denial-explanation-coordinator-${request.id}`}>
          <p className="text-xs font-bold uppercase text-muted-foreground">Coordinator explanation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.denialExplanation}</p>
        </div>}
        {request.status==='pending'&&<>
          <label className="grid gap-1 text-sm font-semibold" htmlFor={`denial-explanation-${request.id}`}>
            Denial explanation (optional)
            <textarea id={`denial-explanation-${request.id}`} rows={3} maxLength={500} className="min-h-20 rounded border bg-card p-3 text-sm font-normal" placeholder="Add context for the requesting FTO" data-testid={`textarea-denial-explanation-${request.id}`}/>
            <span className="text-xs font-normal text-muted-foreground">500 characters maximum. Used only when denying.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={previewOnly||!!reviewingId} onClick={()=>void onReview(request.id,true)} className="min-h-10 rounded bg-primary px-4 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50" data-testid={`button-approve-extension-${request.id}`}>{reviewingId===request.id?'Saving…':'Approve'}</button>
            <button type="button" disabled={previewOnly||!!reviewingId} onClick={event=>{
              const field=event.currentTarget.closest('li')?.querySelector<HTMLTextAreaElement>(`[data-testid="textarea-denial-explanation-${request.id}"]`);
              void onReview(request.id,false,field?.value);
            }} className="min-h-10 rounded border bg-card px-4 text-sm font-bold uppercase disabled:opacity-50" data-testid={`button-deny-extension-${request.id}`}>Deny</button>
          </div>
        </>}
      </li>)}
    </ul>}
    <p className="border-t px-4 py-3 text-xs text-muted-foreground">{previewOnly?'Fictional preview data stays in memory and clears on refresh. No request or decision is sent.':'Requests and review decisions are stored by the authenticated agency service and are available across devices.'}</p>
  </Panel>;
}

export function PhaseExtensionPanel() {
  const {ws,vault,previewOnly,previewLabel,submitPhaseExtensionRequest,syncSharedPhaseExtensionRequest}=useWorkspace();
  const {getToken,isLoaded,isSignedIn}=useAuth();
  const {toast}=useToast();
  const [extensionType,setExtensionType]=React.useState<PhaseExtensionRequest['extensionType']>('training_weeks');
  const [requestedWeeks,setRequestedWeeks]=React.useState(1);
  const [justification,setJustification]=React.useState('');
  const [sharedRequests,setSharedRequests]=React.useState<PhaseExtensionRequest[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [serviceError,setServiceError]=React.useState<string|null>(null);
  const [serverRole,setServerRole]=React.useState<'FTO'|'FTO_COORDINATOR'|null>(null);
  const [reviewingId,setReviewingId]=React.useState<string>();
  const localRequests=ws.phaseExtensionRequests??[];

  React.useEffect(()=>{
    if(previewOnly||!isLoaded||!isSignedIn)return;
    let active=true;
    async function refresh() {
      setLoading(true);
      try {
        const token=await getToken();
        if(!token)throw new PhaseExtensionApiError('Sign in again to load shared requests.',401);
        const result=await listSharedPhaseExtensionRequests(token);
        if(!active)return;
        setServerRole(result.role);
        setSharedRequests(result.requests);
        setServiceError(null);
        if(ws.role==='fto'&&vault==='unlocked') {
          for(const request of result.requests) {
            if(request.status==='approved'||localRequests.some(item=>item.id===request.id)) {
              await syncSharedPhaseExtensionRequest(request);
            }
          }
        }
      } catch(error) {
        reportUnexpectedOperatorError(error,'Could not load shared phase-extension requests');
        if(active)setServiceError(operatorErrorMessage(error,'Shared requests are unavailable. Try again later.'));
      } finally {
        if(active)setLoading(false);
      }
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),30_000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[getToken,isLoaded,isSignedIn,ws.role,vault,previewOnly]);

  async function reviewRequest(id:string,approve:boolean,denialExplanation?:string) {
    if(previewOnly)return;
    setReviewingId(id);
    try {
      const token=await getToken();
      if(!token)throw new PhaseExtensionApiError('Sign in again to review this request.',401);
      const reviewed=await reviewSharedPhaseExtensionRequest(token,id,approve,denialExplanation);
      setSharedRequests(current=>[reviewed,...current.filter(request=>request.id!==id)]);
      setServiceError(null);
      toast(approve
        ?{title:'Extension approved',description:`${reviewed.className} · ${reviewed.recruitName} can see the decision from their device.`}
        :{title:'Request denied',description:`${reviewed.className} · ${reviewed.recruitName} can see the decision from their device.`});
    } catch(error) {
      const failure=operatorErrorToast('Review could not be saved',error,'The review could not be confirmed. Refresh requests before trying again.');
      setServiceError(failure.description);
      toast(failure);
    } finally {
      setReviewingId(undefined);
    }
  }

  if(previewOnly&&previewLabel==='FTO test packet') return <Panel title="Phase extensions are disabled in this test packet" className="mb-4">
    <p className="p-4 text-sm">The fictional packet cannot send or receive requests or decisions from the shared agency service.</p>
  </Panel>;

  if(previewOnly&&ws.role==='fto_coordinator') {
    return <PhaseExtensionReviewView
      requests={localRequests.filter(request=>request.status==='pending')}
      onReview={async()=>{}}
      previewOnly
    />;
  }

  if(previewOnly&&ws.role==='fto') {
    return <Panel title="Request a phase extension · preview only" className="mb-4" id="panel-phase-extension-request">
      <div className="grid gap-3 p-4">
        <p className="text-sm text-muted-foreground">{ws.caseFolder?.className ?? 'Fictional FTO sample'} · {ws.caseFolder?.recruitName ?? 'DEMO PO'} · phase {ws.caseFolder?.phase ?? 3}.</p>
        <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This sample shows the FTO extension-request area. Submission is disabled; previews never read or write shared requests.</p>
      </div>
    </Panel>;
  }

  if(previewOnly)return null;

  if(ws.role==='fto_coordinator'&&serverRole==='FTO_COORDINATOR') {
    return <PhaseExtensionReviewView
      requests={sharedRequests.filter(request=>request.status==='pending'||(request.status==='denied'&&!!request.denialExplanation))}
      onReview={reviewRequest}
      reviewingId={reviewingId}
      loading={loading}
      error={serviceError}
    />;
  }

  if(ws.role==='fto_coordinator') {
    const message=serverRole==='FTO'
      ?'This signed-in account has the FTO role. Coordinator review controls are not available.'
      :serviceError??'Verifying Coordinator access…';
    return <Panel title="Coordinator review access"><p role={serviceError?'alert':'status'} className="p-4 text-sm">{message}</p></Panel>;
  }

  if(ws.role!=='fto')return null;
  if(serverRole==='FTO_COORDINATOR') {
    return <Panel title="Coordinator account"><p role="status" className="p-4 text-sm">This signed-in account has Coordinator access. Switch to the Coordinator role view to review requests.</p></Panel>;
  }
  const folder=ws.caseFolder;
  const matchingPending=folder?[...sharedRequests,...localRequests].filter(request=>request.status!=='denied'&&request.status!=='approved'&&request.recruitBadge.toLowerCase()===folder.recruitBadge.toLowerCase()
    &&request.phase===folder.phase&&(request.className??'').toLowerCase()===(folder.className??'').toLowerCase()):[];
  const localDraft=matchingPending.find(request=>request.status==='local_draft');
  const remotePending=matchingPending.some(request=>request.status==='pending');
  const visibleRequests=[...sharedRequests,...localRequests.filter(request=>!sharedRequests.some(remote=>remote.id===request.id))]
    .sort((left,right)=>right.createdAt.localeCompare(left.createdAt));
  const statusPanel=visibleRequests.length>0&&<Panel title="Phase extension request status" className="mb-4" id="panel-phase-extension-status">
    <ul className="divide-y">
      {visibleRequests.map(request=><li key={request.id} className="grid gap-1 p-4" data-testid={`phase-extension-status-${request.id}`}>
        <p className="font-semibold">{request.className} · {request.recruitName} #{request.recruitBadge} · {phaseLabel(request.phase)}</p>
        <p className="text-sm">{request.extensionType==='limbo_period'?'Limbo period':'Training phase'} · {request.requestedWeeks} additional week{request.requestedWeeks===1?'':'s'}</p>
        <p className="text-sm text-muted-foreground">{request.status==='local_draft'?'Saved on this device · not sent':request.status==='pending'?'Submitted · awaiting Coordinator review':request.status==='approved'?'Approved':'Denied'}</p>
        {request.reviewedAt&&<time className="text-xs text-muted-foreground" dateTime={request.reviewedAt}>Reviewed {new Date(request.reviewedAt).toLocaleDateString()}</time>}
        {request.status==='denied'&&request.denialExplanation&&<div className="mt-1 rounded border bg-muted/40 p-3" data-testid={`denial-explanation-fto-${request.id}`}>
          <p className="text-xs font-bold uppercase text-muted-foreground">Coordinator explanation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.denialExplanation}</p>
        </div>}
        {request.status==='local_draft'&&<button type="button" onClick={()=>void retryDraft(request)} disabled={vault!=='unlocked'||!isLoaded||!isSignedIn||loading} className="mt-2 min-h-10 justify-self-start rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid={`button-retry-extension-${request.id}`}>Send saved request</button>}
      </li>)}
    </ul>
  </Panel>;
  if(!folder)return <>{serviceError&&<p role="status" className="mb-4 rounded border bg-accent/10 p-3 text-sm">{serviceError} Local drafts remain on this device.</p>}{statusPanel}</>;
  const activeFolder=folder;

  async function sendRequest(request:PhaseExtensionRequest) {
    if(previewOnly)throw new Error('Shared phase-extension requests are disabled in the fictional preview.');
    if(vault!=='unlocked')throw new Error('Unlock this device’s encrypted workspace first.');
    if(!isLoaded||!isSignedIn)throw new PhaseExtensionApiError('Sign in with your approved staff account.',401);
    if(!navigator.onLine) {
      await submitPhaseExtensionRequest({...request,status:'local_draft'});
      return 'offline';
    }
    const token=await getToken();
    if(!token)throw new PhaseExtensionApiError('Sign in again to submit this request.',401);
    let saved:PhaseExtensionRequest;
    try {
      saved=await submitSharedPhaseExtensionRequest(token,request);
    } catch(error) {
      if(error instanceof PhaseExtensionApiError&&(error.status===401||error.status===403||error.status===400||error.status===409))throw error;
      await submitPhaseExtensionRequest({...request,status:'local_draft'});
      return 'offline';
    }
    await submitPhaseExtensionRequest(saved);
    setSharedRequests(current=>[saved,...current.filter(item=>item.id!==saved.id)]);
    setServiceError(null);
    return 'sent';
  }

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(remotePending||localDraft)return;
    const valid=phaseExtensionRequestInputSchema.safeParse({extensionType,requestedWeeks,justification});
    if(!valid.success)return;
    const request:PhaseExtensionRequest={
      id:crypto.randomUUID(),className:activeFolder.className??'',recruitName:activeFolder.recruitName,recruitBadge:activeFolder.recruitBadge,
      phase:activeFolder.phase,phaseStartDate:activeFolder.phaseStartDate,requestingFtoName:activeFolder.ftoName,requestingFtoBadge:activeFolder.ftoBadge,
      ...valid.data,createdAt:new Date().toISOString(),status:'pending',
    };
    try {
      const outcome=await sendRequest(request);
      setJustification('');
      toast(outcome==='sent'
        ?{title:'Request sent for review',description:'The FTO Coordinator can review it from another device.'}
        :{title:'Request saved on this device',description:'It has not been sent. Retry when the shared service is available.'});
    } catch(error) {
      toast(operatorErrorToast(
        'Request not submitted',
        error,
        'The request could not be submitted. Check its status before trying again.',
      ));
    }
  }

  async function retryDraft(request:PhaseExtensionRequest) {
    try {
      const outcome=await sendRequest(request);
      if(outcome==='sent')toast({title:'Saved request sent',description:'The FTO Coordinator can review it from another device.'});
      else toast({title:'Request is still saved locally',description:'It has not been sent yet.'});
    } catch(error) {
      toast(operatorErrorToast(
        'Request not submitted',
        error,
        'The request could not be submitted. Check its status before trying again.',
      ));
    }
  }

  return <>
  {serviceError&&<p role="status" className="mb-4 rounded border bg-accent/10 p-3 text-sm">{serviceError} Local drafts remain on this device.</p>}
  {statusPanel}
  <Panel title="Request a phase extension" className="mb-4" id="panel-phase-extension-request">
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
      {remotePending&&<p role="status" className="rounded border bg-muted/40 p-3 text-sm">A request is awaiting Coordinator review. You can continue phase paperwork while it is reviewed.</p>}
      {localDraft&&<p role="status" className="rounded border bg-muted/40 p-3 text-sm">A request is saved only on this device. Use “Send saved request” above when the shared service is available.</p>}
      <button type="submit" disabled={vault!=='unlocked'||!justification.trim()||requestedWeeks<1||!Number.isInteger(requestedWeeks)||remotePending||!!localDraft||!isLoaded||!isSignedIn||(!serverRole&&!serviceError&&loading)} className="min-h-11 justify-self-start rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-submit-extension">Submit for Coordinator approval</button>
      <p className="text-xs text-muted-foreground">{vault==='unlocked'?'Requests are sent for Coordinator review. If the service is unavailable, the request remains an unsent draft on this device.':'Unlock saved work before submitting a request.'}</p>
      <Link href="/resources?topic=phase-request#application-help" className="justify-self-start text-sm font-semibold text-primary underline underline-offset-2">Request status help</Link>
    </form>
  </Panel>
  </>;
}
