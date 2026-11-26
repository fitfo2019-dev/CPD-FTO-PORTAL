import {useState} from 'react';
import {useLocation} from 'wouter';
import {useListPacketSubmissions,getListPacketSubmissionsQueryKey,useGetPacketSubmission,getGetPacketSubmissionQueryKey} from '@workspace/api-client-react';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog.js';
import {Button} from '@/components/ui/button.js';
import {usePacketReview,packetReviewError} from '@/state/packet-review.js';
import {HandoffTag,StatusTag,PacketDocument,when} from '@/components/packet-review/packet-view.js';
import {PoPacketSummary} from '@/components/packet-review/po-summary.js';

const PAGE=50;
function Skeleton() {return <div className="space-y-2" aria-busy="true">{[0,1,2].map(i=><div key={i} className="uploaded-resource-skeleton !min-h-14"/>)}</div>;}

function Detail({id,onClose}:{id:string;onClose():void}) {
  const {context,act,openCorrection}=usePacketReview();
  const [,navigate]=useLocation();
  const live=!!context?.available;
  const q=useGetPacketSubmission(id,{query:{enabled:live,queryKey:[...getGetPacketSubmissionQueryKey(id),context?.account_id],retry:false}});
  const [confirm,setConfirm]=useState<'approve'|'return'|null>(null);
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState<string|null>(null);
  const role=context?.role;
  const poView=role==='PO';
  const s=q.data?.submission;
  const run=async(fn:()=>Promise<unknown>,done?:()=>void)=>{
    setBusy(true);setFailure(null);
    try{await fn();await q.refetch();setConfirm(null);setNote('');done?.();}catch(e){setFailure(packetReviewError(e));}finally{setBusy(false);}
  };
  const reviewPoTotals=async()=>{
    if(!s||!q.data?.po_totals)return;
    setBusy(true);setFailure(null);
    try{await act(s.id,'review_totals');onClose();}catch(e){setFailure(packetReviewError(e));}finally{setBusy(false);}
  };
  return <section className="border-2 border-primary/40 bg-background p-4" data-testid="packet-detail">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-[family-name:var(--app-font-display)] text-xl text-foreground">{poView?'Your packet review':'Packet Detail'}</h2>
      <Button variant="outline" data-testid="button-close-detail" onClick={onClose}>CLOSE</Button>
    </div>
    {q.isLoading&&<Skeleton/>}
    {q.error&&<div role="alert" className="flex items-center justify-between gap-2 border border-destructive p-3 text-sm text-destructive">{packetReviewError(q.error)}<Button variant="outline" onClick={()=>void q.refetch()}>RETRY</Button></div>}
    {q.data&&s&&<div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 border border-border bg-card p-3 text-sm">
        {poView?<HandoffTag status={s.handoff_status}/>:<><StatusTag state={s.state}/><HandoffTag status={s.handoff_status}/></>}
        <span>{s.record_date}{!poView&&` · ${s.po_name} · FTO ${s.fto_name}`}</span>
        {!poView&&<span className="mono text-xs text-muted-foreground">v{s.packet_version} · Coordinator {s.coordinator_name}</span>}
      </div>
      {failure&&!confirm&&<p role="alert" className="text-sm text-destructive">{failure}</p>}
      {role==='FTO_COORDINATOR'&&<div className="flex flex-wrap gap-2">
        {s.state==='submitted'&&<Button data-testid="button-detail-acknowledge" disabled={busy} onClick={()=>void run(()=>act(s.id,'acknowledge'))}>ACKNOWLEDGE PACKET</Button>}
        <Button data-testid="button-approve" disabled={busy||s.state!=='acknowledged'} onClick={()=>{setFailure(null);setConfirm('approve');}}>APPROVE PACKET</Button>
        <Button variant="destructive" data-testid="button-return" disabled={busy||!(s.state==='acknowledged'||s.state==='submitted')} onClick={()=>{setFailure(null);setConfirm('return');}}>RETURN FOR CORRECTION</Button>
        {s.state==='submitted'&&<p className="w-full text-xs text-muted-foreground">Acknowledge receipt before approving. Acknowledgement is not approval.</p>}
      </div>}
      {role==='FTO'&&s.can_correct&&s.state==='correction_requested'&&q.data.report&&<Button data-testid="button-open-correction" disabled={busy}
        onClick={()=>void run(()=>openCorrection(s.packet_id),()=>navigate(`/reports/${q.data!.report!.id}`))}>OPEN CORRECTION</Button>}
      {poView
        ? q.data.po_totals
          ? <PoPacketSummary totals={q.data.po_totals} testId="po-submission-summary"/>
          : <div role="alert" className="border border-destructive p-3 text-sm" data-testid="status-po-summary-unavailable">Your summary could not be loaded, so no review action is available. Retry or contact your training Coordinator.</div>
        : <PacketDocument detail={q.data}/>}
      {poView&&s.handoff_status==='awaiting_po_totals_review'&&q.data.po_totals&&<div className="border border-primary/30 bg-primary/5 p-3" data-testid="section-po-review-confirmation">
        <p className="mb-3 text-sm">After your review is recorded, the packet becomes visible to its assigned Coordinator.</p>
        <Button data-testid="button-review-po-totals" disabled={busy} onClick={()=>void reviewPoTotals()}>CONFIRM MY REVIEW</Button>
      </div>}
      {poView&&s.handoff_status!=='awaiting_po_totals_review'&&<p className="border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Your review was recorded. A released packet and its receipt action appear under Agency Packets.
      </p>}
    </div>}
    <AlertDialog open={!!confirm} onOpenChange={o=>{if(!o&&!busy)setConfirm(null);}}>
      <AlertDialogContent className="sm:rounded-none">
        <AlertDialogTitle className="tracking-[0.06em]">{confirm==='approve'?'APPROVE PACKET':'RETURN FOR CORRECTION'}</AlertDialogTitle>
        <AlertDialogDescription>{confirm==='approve'?'Approval marks this packet COMPLETE in the agency record.':'The FTO will be asked to correct this packet. A Coordinator note is required.'}</AlertDialogDescription>
        {confirm==='return'&&<textarea data-testid="input-return-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={5000} rows={4} className="w-full rounded border border-input bg-card p-2 text-sm" placeholder="Describe what must be corrected"/>}
        {failure&&<p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>CANCEL</AlertDialogCancel>
          <Button data-testid="button-confirm-action" variant={confirm==='return'?'destructive':'default'} disabled={busy||(confirm==='return'&&!note.trim())}
            onClick={()=>s&&confirm&&void run(()=>act(s.id,confirm,confirm==='return'?note:''))}>{busy?'WORKING…':'CONFIRM'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function Assignments() {
  const {context,assign}=usePacketReview();
  const [picks,setPicks]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [failure,setFailure]=useState<string|null>(null);
  const [pending,setPending]=useState<{po_id:string;rev:number}|null>(null);
  if(!context?.available||(context.role!=='FTO_COORDINATOR'&&context.role!=='PO')) return null;
  const name=(id:string)=>context.coordinators.find(c=>c.id===id)?.name??'Coordinator not in directory';
  const save=async(po_id:string,expected_revision:number)=>{
    const coordinator_id=picks[po_id];if(!coordinator_id)return;
    setBusy(po_id);setFailure(null);
    try{await assign({po_id,coordinator_id,expected_revision});setPending(null);}catch(e){setFailure(packetReviewError(e));}finally{setBusy(null);}
  };
  return <section className="border border-border bg-card p-4" data-testid="section-assignments">
    <h2 className="label-caps mb-2">Coordinator Assignments</h2>
    {failure&&<p role="alert" className="mb-2 text-sm text-destructive">{failure}</p>}
    {context.assignments.length===0?<p className="text-sm text-muted-foreground">No assignments on record.</p>:
    <ul className="space-y-2">{context.assignments.map(a=><li key={a.po_id} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">PO {a.po_badge}</span><span>→ {name(a.coordinator_id)}</span>
      {context.role==='FTO_COORDINATOR'&&a.coordinator_id===context.account_id&&context.coordinators.length>0&&<>
        <select aria-label={`Reassign Coordinator for PO ${a.po_badge}`} data-testid={`select-reassign-${a.po_id}`} value={picks[a.po_id]??''} onChange={e=>setPicks(p=>({...p,[a.po_id]:e.target.value}))} className="rounded border border-input">
          <option value="">Reassign to…</option>{context.coordinators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Button variant="outline" data-testid={`button-reassign-${a.po_id}`} disabled={!picks[a.po_id]||busy===a.po_id} onClick={()=>{setFailure(null);setPending({po_id:a.po_id,rev:a.revision});}}>SAVE</Button></>}
    </li>)}</ul>}
    <AlertDialog open={!!pending} onOpenChange={o=>{if(!o&&!busy)setPending(null);}}>
      <AlertDialogContent className="sm:rounded-none">
        <AlertDialogTitle className="tracking-[0.06em]">CONFIRM REASSIGNMENT</AlertDialogTitle>
        <AlertDialogDescription>Reassign to {pending?name(picks[pending.po_id]??''):''}? Open pending packets for this PO move to the new Coordinator and require fresh acknowledgment. Approved packet snapshots remain preserved.</AlertDialogDescription>
        {failure&&<p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy}>CANCEL</AlertDialogCancel>
          <Button data-testid="button-confirm-reassign" disabled={!!busy} onClick={()=>pending&&void save(pending.po_id,pending.rev)}>{busy?'SAVING…':'CONFIRM REASSIGNMENT'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

export default function PacketSubmissions() {
  const {context,loading,error,previewOnly,refresh}=usePacketReview();
  const [offset,setOffset]=useState(0);
  const [openId,setOpenId]=useState<string|null>(null);
  const live=!previewOnly&&!!context?.available;
  const list=useListPacketSubmissions({offset},{query:{enabled:live,queryKey:[...getListPacketSubmissionsQueryKey({offset}),context?.account_id],refetchInterval:5000,retry:false}});
  const items=list.data?.items??[];
  return <div className="space-y-4 pb-8">
    <header className="border border-border border-t-4 border-t-primary bg-card p-4">
      <p className="library-eyebrow">Packet Submissions</p>
      <h1 className="page-title text-2xl">Daily Packet Status</h1>
    </header>
    {previewOnly?<p role="status" className="border border-dashed border-border p-4 text-sm">Not loaded</p>
    :loading?<Skeleton/>
    :error||!context?<div role="alert" className="flex items-center justify-between gap-2 border border-destructive bg-card p-4 text-sm text-destructive">{error??'Packet service unavailable.'}<Button variant="outline" onClick={()=>void refresh().catch(()=>{})}>RETRY</Button></div>
    :!context.available?<p role="status" className="border border-dashed border-border bg-card p-4 text-sm">Agency packet storage is not configured or unavailable. Local drafting remains available.</p>
    :<>
      {(context.role==='FTO_COORDINATOR'||context.role==='PO')&&<Assignments/>}
      {openId&&<Detail key={openId} id={openId} onClose={()=>setOpenId(null)}/>}
      <section className="border border-border bg-card">
        {list.isLoading?<div className="p-4"><Skeleton/></div>
        :list.error?<div role="alert" className="flex items-center justify-between gap-2 p-4 text-sm text-destructive">{packetReviewError(list.error)}<Button variant="outline" onClick={()=>void list.refetch()}>RETRY</Button></div>
        :items.length===0?<p className="p-6 text-center text-sm text-muted-foreground" data-testid="text-empty">{offset>0?'No packets on this page.':'No packet submissions on record.'}</p>
        :<div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-muted text-xs uppercase tracking-[0.1em]"><tr>
          <th className="p-2">Record Date</th>{context.role!=='PO'&&<><th className="p-2">Probationary</th><th className="p-2">FTO</th><th className="p-2">Coordinator</th></>}
          <th className="p-2">Handoff</th>{context.role!=='PO'&&<th className="p-2">Review State</th>}<th className="p-2">Submitted</th><th className="p-2"/></tr></thead>
          <tbody>{items.map(p=><tr key={p.id} className={`border-t border-border ${openId===p.id?'bg-primary/5':''}`} data-testid={`row-packet-${p.id}`}>
            <td className="p-2 mono">{p.record_date}</td>{context.role!=='PO'&&<><td className="p-2">{p.po_name}</td><td className="p-2">{p.fto_name}</td><td className="p-2">{p.coordinator_name}</td></>}
            <td className="p-2"><HandoffTag status={p.handoff_status}/></td>{context.role!=='PO'&&<td className="p-2"><StatusTag state={p.state}/></td>}
            <td className="p-2 text-xs">{when(p.submitted_at)}</td>
            <td className="p-2"><Button variant="outline" data-testid={`button-open-${p.id}`} onClick={()=>setOpenId(p.id)}>OPEN</Button></td></tr>)}</tbody></table></div>}
        <div className="flex items-center justify-between border-t border-border p-3">
          <Button variant="outline" data-testid="button-prev" disabled={offset===0} onClick={()=>setOffset(o=>Math.max(0,o-PAGE))}>PREVIOUS</Button>
          <span className="mono text-xs text-muted-foreground">{items.length?`${offset+1}–${offset+items.length}`:''}</span>
          <Button variant="outline" data-testid="button-next" disabled={!list.data?.has_more} onClick={()=>list.data&&setOffset(list.data.next_offset)}>NEXT</Button>
        </div>
      </section>
    </>}
  </div>;
}
