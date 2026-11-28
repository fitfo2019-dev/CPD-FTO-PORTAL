import React,{useState} from 'react';
import {Link} from 'wouter';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog.js';
import {Button} from '@/components/ui/button.js';
import {usePacketReview,packetReviewError} from '@/state/packet-review.js';
import {useWorkspace} from '@/state/workspace.js';
import {useReturnedPackets,ReturnedBadge} from './returned-packets.js';

export function PacketSubmitControl({
  reportId,
  disabled,
  missing=[],
  onGoToMissing,
}:{
  reportId:string;
  disabled?:boolean;
  /** Required parts not yet complete; submission stays blocked until empty. */
  missing?:string[];
  onGoToMissing?:(item:string)=>void;
}) {
  const {context,previewOnly,finalizeReport}=usePacketReview();
  const {ws}=useWorkspace();
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState<string|null>(null);
  const returned=useReturnedPackets().get(reportId);
  if(previewOnly||context?.role!=='FTO') return null;
  const report=ws.reports.find(r=>r.id===reportId);
  const sealed=report?.syncStatus==='synchronized_complete'||report?.syncStatus==='submitted_complete';
  const blocked=!!disabled||!context.available||sealed||busy||missing.length>0;
  const submit=async()=>{
    setBusy(true);setFailure(null);
    try{await finalizeReport(reportId);setOpen(false);}catch(e){setFailure(packetReviewError(e));}finally{setBusy(false);}
  };
  return <section className="mt-4 border border-border border-l-4 border-l-primary bg-card p-4" data-testid="section-packet-submit">
    <div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="label-caps">Coordinator Submission</h3>{returned&&!sealed&&<ReturnedBadge/>}</div>
    {returned&&!sealed&&<div className="mb-2 border border-destructive bg-destructive/5 p-3 text-sm" data-testid="section-returned-reason">
      <b className="label-caps block text-destructive">Returned by Coordinator{returned.returnedAt?` · ${new Date(returned.returnedAt).toLocaleString()}`:''}</b>
      <p className="mt-1 whitespace-pre-wrap">{returned.reason}</p>
    </div>}
    <p className="text-sm">Draft sync stores your work only. It never submits a packet. Submission happens only when you confirm below.</p>
    {!context.available&&<p role="status" className="mt-2 text-sm text-warn">The shared packet service is unavailable. Local drafting continues normally.</p>}
    {sealed&&<p role="status" className="mt-2 text-sm text-ok">This packet has been finalized and sealed.</p>}
    {failure&&!open&&<p role="alert" className="mt-2 text-sm text-destructive">{failure}</p>}
    {!sealed&&missing.length>0&&<div role="status" className="mt-3 border border-warn bg-warn/5 p-3 text-sm" data-testid="list-missing-before-submit">
      <b className="label-caps block">{missing.length===1?'1 item missing':`${missing.length} items missing`}</b>
      <ul className="mt-1 list-disc pl-5">{missing.map(item=><li key={item}>{onGoToMissing
        ?<button type="button" className="text-left underline underline-offset-2" onClick={()=>onGoToMissing(item)} data-testid="button-missing-goto">{item}</button>
        :item}</li>)}</ul>
    </div>}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button data-testid="button-finalize-submit" disabled={blocked} onClick={()=>{setFailure(null);setOpen(true);}} className="font-bold tracking-[0.08em]">FINALIZE AND SUBMIT TO COORDINATOR</Button>
      <Link href="/packet-submissions" data-testid="link-packet-status" className="text-sm font-semibold underline">View shared packet status</Link>
    </div>
    <AlertDialog open={open} onOpenChange={o=>{if(!busy)setOpen(o);}}>
      <AlertDialogContent className="sm:rounded-none">
        <AlertDialogTitle className="tracking-[0.06em]">FINALIZE AND SUBMIT TO COORDINATOR</AlertDialogTitle>
        <AlertDialogDescription>This packet will be sent only to the FTO Coordinator assigned to this probationary officer. On success the packet is sealed and can only change through a Coordinator-requested correction.</AlertDialogDescription>
        {failure&&<p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} data-testid="button-cancel-submit">CANCEL</AlertDialogCancel>
          <Button data-testid="button-confirm-submit" disabled={busy} onClick={()=>void submit()}>{busy?'SUBMITTING…':'CONFIRM SUBMISSION'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
