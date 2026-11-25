import {useState} from 'react';
import {useClerk} from '@clerk/react';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription} from '@/components/ui/alert-dialog.js';
import {Button} from '@/components/ui/button.js';
import {usePacketReview,packetReviewError} from '@/state/packet-review.js';
import {when} from './packet-view.js';

const block=(e:Event)=>e.preventDefault();

export function PacketReviewGate() {
  const {context,loading,error,previewOnly,refresh,act,assign}=usePacketReview();
  const {signOut}=useClerk();
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState<string|null>(null);
  const [choice,setChoice]=useState('');
  if(previewOnly||loading) return null;

  const run=async(fn:()=>Promise<unknown>)=>{
    setBusy(true);setFailure(null);
    try{await fn();}catch(e){setFailure(packetReviewError(e));}finally{setBusy(false);}
  };
  const isCoord=context?.role==='FTO_COORDINATOR';
  let body:React.ReactNode=null;let title='';

  if(context&&isCoord&&!context.available) {
    title='PACKET SERVICE UNAVAILABLE';
    body=<p>The shared packet service could not be reached, so pending packet notifications cannot be confirmed. {error??'Agency packet storage is not configured or unavailable.'}</p>;
  } else if(context&&isCoord&&error) {
    title='PACKET SERVICE UNAVAILABLE';
    body=<p>Pending packet status could not be refreshed. {error}</p>;
  } else if(context?.available&&isCoord&&context.pending_count>0&&context.pending) {
    const p=context.pending;
    title='PACKET RECEIVED';
    body=<div className="space-y-3">
      <p>A daily training packet has been submitted to you. {context.pending_count>1&&<strong>{context.pending_count} packets are awaiting acknowledgement.</strong>}</p>
      <dl className="grid grid-cols-[8rem_1fr] gap-1 border border-white/30 bg-black/15 p-3 text-sm" data-testid="pending-packet-meta">
        <dt className="font-bold">RECORD DATE</dt><dd>{p.record_date}</dd>
        <dt className="font-bold">PROBATIONARY</dt><dd>{p.po_name}</dd>
        <dt className="font-bold">FTO</dt><dd>{p.fto_name}</dd>
        <dt className="font-bold">VERSION</dt><dd className="mono">{p.packet_version}</dd>
        <dt className="font-bold">SUBMITTED</dt><dd>{when(p.submitted_at)}</dd>
      </dl>
      <p className="text-sm">Acknowledging confirms receipt only. It does not approve the packet. Review and approval happen in Packet Submissions.</p>
      <Button data-testid="button-acknowledge-packet" disabled={busy} onClick={()=>run(()=>act(p.id,'acknowledge'))}
        className="w-full bg-white font-bold tracking-[0.1em] text-[hsl(0_73%_35%)] hover:bg-white/90">{busy?'ACKNOWLEDGING…':'ACKNOWLEDGE PACKET'}</Button>
    </div>;
  } else if(context?.available&&context.role==='PO'&&context.assignments.length===0) {
    title='SELECT YOUR FTO COORDINATOR';
    body=<div className="space-y-3">
      <p>Before continuing, choose the FTO Coordinator who will receive your daily training packets. This choice is recorded by the agency service.</p>
      {context.coordinators.length===0?<p className="border border-white/40 p-3 text-sm">No FTO Coordinators are listed in the agency directory yet. Contact your training unit, then retry.</p>:
        <select data-testid="select-coordinator" value={choice} onChange={e=>setChoice(e.target.value)} className="min-h-11 w-full rounded border border-white/50 bg-white px-3 text-[hsl(214_52%_18%)]">
          <option value="">Choose a Coordinator</option>
          {context.coordinators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>}
      <Button data-testid="button-save-coordinator" disabled={busy||!choice} onClick={()=>run(()=>assign({po_id:context.account_id,coordinator_id:choice,expected_revision:0}))}
        className="w-full bg-white font-bold tracking-[0.1em] text-[hsl(0_73%_35%)] hover:bg-white/90">{busy?'SAVING…':'SAVE COORDINATOR'}</Button>
    </div>;
  } else return null;

  return <AlertDialog open>
    <AlertDialogContent onEscapeKeyDown={block} className="border-4 border-white/70 bg-[hsl(0_73%_38%)] text-white sm:rounded-none" data-testid="packet-gate">
      <AlertDialogTitle className="font-[family-name:var(--app-font-display)] text-2xl tracking-[0.06em]">{title}</AlertDialogTitle>
      <AlertDialogDescription asChild><div className="text-sm text-white/95">{body}</div></AlertDialogDescription>
      {failure&&<p role="alert" className="border border-white bg-black/25 p-2 text-sm">{failure}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" data-testid="button-gate-retry" disabled={busy} onClick={()=>run(refresh)} className="border-white bg-transparent font-bold tracking-[0.1em] text-white hover:bg-white/10">RETRY</Button>
        <Button variant="outline" data-testid="button-gate-signout" onClick={()=>void signOut()} className="border-white bg-transparent font-bold tracking-[0.1em] text-white hover:bg-white/10">SIGN OUT</Button>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
