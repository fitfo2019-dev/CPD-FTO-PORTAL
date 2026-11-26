import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { CATEGORIES, CATEGORY_LABEL, type Category, type RatingEntry } from '@/lib/model.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { nrtReference } from '@/lib/nrt-reference.js';
import { useWorkspace } from '@/state/workspace.js';

export default function NrtFollowUpPage() {
  const { id } = useParams<{ id:string }>();
  const [, navigate] = useLocation();
  const { ws, upsertReport } = useWorkspace();
  const report = ws.reports.find(item => item.id === id);
  const categoryParam = new URLSearchParams(window.location.search).get('category');
  const category = CATEGORIES.includes(categoryParam as Category) ? categoryParam as Category : undefined;
  const entry = report && category ? report.ratings[category] : undefined;
  const priorUas = useMemo(() => report && category
    ? ws.reports
      .filter(item => item.id !== report.id
        && item.className === report.className
        && item.recruitBadge === report.recruitBadge
        && item.date < report.date
        && !!item.ratingsReviewedAt
        && item.ratings[category]?.rating === 'UA')
      .sort((a,b) => a.date.localeCompare(b.date))
    : [], [ws.reports, report?.id, report?.recruitBadge, report?.date, category]);

  if (!report || !category || !entry) {
    return <Panel title="NRT follow-up unavailable"><p className="p-4 text-sm">Open this page from an NRT rating on a saved PO Daily Performance Summary.</p><Link href="/reports" className="m-4 inline-flex items-center gap-1 font-semibold underline"><ArrowLeft className="h-4 w-4"/>Daily Performance Summaries</Link></Panel>;
  }

  const saveEntry = (patch: Partial<RatingEntry>) => {
    if (ws.role!=='fto'||report.status!=='draft'||entry.rating!=='NRT') return;
    const next = {
      ...report,
      ratingsReviewedAt: undefined,
      ratings: { ...report.ratings, [category]: { ...entry, ...patch } },
      updatedAt: new Date().toISOString(),
    };
    upsertReport(next);
  };
  const selected = entry.nrtPriorUnacceptableIds ?? [];
  const editable = ws.role==='fto'&&report.status==='draft'&&entry.rating==='NRT';
  const ready = selected.length > 0 && selected.every(id=>priorUas.some(item=>item.id===id))
    && !!entry.justification?.trim()
    && !!entry.nrtCorrectiveActions?.trim()
    && entry.nrtPriorDocumentationReviewed
    && entry.nrtTrainingReviewed
    && entry.nrtCoordinatorsNotified
    && entry.nrtFtoSergeantNotified;

  return <div className="mx-auto w-full max-w-4xl">
    <Link href={`/reports/${report.id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"><ArrowLeft className="h-4 w-4"/>Return to daily summary</Link>
    <PageHead kicker="NRT follow-up" title={`PO ${report.recruitName} #${report.recruitBadge}`} titleIsData>
      <span className="rounded border bg-card px-3 py-2 text-sm font-semibold">{nrtReference(report,ws.assignments,ws.caseFolder)}</span>
    </PageHead>
    <div role="note" className="mb-4 rounded border border-warn/60 bg-warn/10 p-3 text-sm">
      <b>NRT is one rating, not UA and NRT at the same time.</b> Link at least one earlier reviewed UA for this PO and category, document the response to training, then submit the review for the FTO Coordinator.
    </div>
    {!editable && <p role="note" className="mb-4 rounded border p-3 text-sm">Read-only. Select NRT on a draft daily log in the FTO role view to edit this follow-up.</p>}
    <fieldset disabled={!editable}>
    <Panel title={`Earlier Unacceptable entries · ${CATEGORY_LABEL[category]}`}>
      {priorUas.length === 0
        ? <div className="flex gap-2 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-warn"/><p>No earlier reviewed UA entry exists for this category. NRT cannot be prepared without a prior UA to reference.</p></div>
        : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3 text-sm">
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={priorUas.length > 0 && priorUas.every(item=>selected.includes(item.id))}
                onChange={event=>saveEntry({
                  nrtPriorUnacceptableIds:event.target.checked?priorUas.map(item=>item.id):[],
                  nrtOfficeReviewStatus:'not_submitted',
                  nrtOfficeAction:undefined,
                  nrtOfficeResponse:'',
                })}
                data-testid="checkbox-select-all-prior-ua"
              />
              Select all prior UA entries for this category
            </label>
            <span className="text-xs text-muted-foreground">{selected.filter(id=>priorUas.some(item=>item.id===id)).length} of {priorUas.length} linked</span>
          </div>
          <div className="divide-y">{priorUas.map(item=>{
          const reference=nrtReference(item,ws.assignments,ws.caseFolder);
          return <label key={item.id} className="flex min-h-14 items-start gap-3 p-4 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={selected.includes(item.id)} onChange={event=>{
              const ids=event.target.checked?[...new Set([...selected,item.id])]:selected.filter(value=>value!==item.id);
              saveEntry({nrtPriorUnacceptableIds:ids,nrtOfficeReviewStatus:'not_submitted',nrtOfficeAction:undefined,nrtOfficeResponse:''});
            }} data-testid={`checkbox-prior-ua-${item.id}`}/>
            <span className="min-w-0 flex-1"><b className="mono">{reference}</b> · {CATEGORY_LABEL[category]} · {formatDateDMY(item.date)} · Phase {item.phase}<br/><span className="text-muted-foreground">{item.ratings[category].justification || 'No justification saved.'}</span></span>
          </label>;
        })}</div>
        </>}
    </Panel>
    <Panel title="FTO explanation and corrective training" className="mt-4">
      <div className="grid gap-4 p-4">
        <label className="grid gap-1 text-sm font-semibold">Why this PO earned NRT
          <textarea rows={4} value={entry.justification} onChange={event=>saveEntry({justification:event.target.value,nrtOfficeReviewStatus:'not_submitted'})} className="min-h-28 w-full rounded border bg-card p-3 text-sm font-normal" placeholder="Describe specific observed performance and the prior coaching response." data-testid="input-nrt-explanation"/>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Corrective actions and retraining
          <textarea rows={5} value={entry.nrtCorrectiveActions ?? ''} onChange={event=>saveEntry({nrtCorrectiveActions:event.target.value,nrtOfficeReviewStatus:'not_submitted'})} className="min-h-32 w-full rounded border bg-card p-3 text-sm font-normal" placeholder="Document what training was provided, when, and the PO’s response." data-testid="input-nrt-corrective-actions"/>
        </label>
        <div className="grid gap-2 rounded border bg-muted/30 p-3 text-sm">
          {([
            ['nrtPriorDocumentationReviewed','I reviewed the earlier UA documentation.'],
            ['nrtTrainingReviewed','I confirmed training and corrective coaching were provided.'],
            ['nrtCoordinatorsNotified','I notified the FTO Coordinator.'],
            ['nrtFtoSergeantNotified','I notified the FTO Sergeant.'],
          ] as const).map(([key,label])=><label key={key} className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!entry[key]} onChange={event=>saveEntry({[key]:event.target.checked,nrtOfficeReviewStatus:'not_submitted'})} data-testid={`checkbox-nrt-${key}`}/><span>{label}</span></label>)}
        </div>
        {entry.nrtOfficeReviewStatus==='submitted' && <p role="status" className="flex gap-2 rounded border border-accent/40 bg-accent/10 p-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0"/><span>Saved to this device’s FTO Coordinator review list. No alert or cross-account sharing is configured.</span></p>}
        {entry.nrtOfficeReviewStatus==='responded' && <p role="status" className="rounded border bg-card p-3 text-sm"><b>FTO Coordinator response:</b> {entry.nrtOfficeAction?.replaceAll('_',' ')}{entry.nrtOfficeResponse ? ` — ${entry.nrtOfficeResponse}` : ''}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || !editable} onClick={()=>{
            saveEntry({nrtOfficeReviewStatus:'submitted',nrtOfficeSubmittedAt:new Date().toISOString(),nrtOfficeAction:undefined,nrtOfficeResponse:''});
          }} className="min-h-11 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-nrt-review">Submit NRT review to FTO Coordinator</button>
          <button type="button" onClick={()=>navigate(`/reports/${report.id}`)} className="min-h-11 rounded border bg-card px-4 text-sm font-semibold" data-testid="button-return-nrt-report">Return to daily summary</button>
        </div>
        <p className="text-xs text-muted-foreground">Unlimited narrative entry; this device-only record does not send or verify official submissions.</p>
      </div>
    </Panel>
    </fieldset>
  </div>;
}
