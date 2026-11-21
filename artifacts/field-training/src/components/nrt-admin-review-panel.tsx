import { useState } from 'react';
import { CheckCircle2, MessageSquareMore } from 'lucide-react';
import { Panel } from '@/components/bits';
import { SearchableSelect } from '@/components/searchable-select';
import { CATEGORIES, CATEGORY_LABEL, type Category, type RatingEntry, type Report } from '@/lib/model';
import { formatDateDMY } from '@/lib/training-calendar';
import { nrtReference } from '@/lib/nrt-reference';
import { useWorkspace } from '@/state/workspace';

const ACTIONS = [
  { value:'accepted_meeting', label:'Accepted · schedule meeting' },
  { value:'call_office', label:'Call FTO Office' },
  { value:'more_information', label:'Request more information' },
] as const;

export function NrtAdminReviewPanel() {
  const { ws, upsertReport } = useWorkspace();
  const pending = ws.reports.flatMap(report => CATEGORIES.flatMap(category => {
    const entry=report.ratings[category];
    return entry.rating==='NRT' && entry.nrtOfficeReviewStatus==='submitted' ? [{report,category,entry}] : [];
  }));
  if (ws.role!=='fto_coordinator') return null;
  return <Panel title="NRT review inbox · FTO Coordinator" className="mb-4">
    <div className="border-b bg-warn/10 p-3 text-sm">
      No alert has been sent to the FTO for these requests.
    </div>
    {pending.length===0
      ? <p className="p-4 text-sm text-muted-foreground" data-testid="text-nrt-review-empty">No NRT review requests are waiting in this local workspace.</p>
      : <ul className="divide-y">{pending.map(({report,category,entry})=><ReviewCard key={`${report.id}-${category}`} report={report} category={category} entry={entry} references={(entry.nrtPriorUnacceptableIds??[]).map(id=>{const prior=ws.reports.find(item=>item.id===id);return prior?`${nrtReference(prior,ws.assignments,ws.caseFolder)} · ${formatDateDMY(prior.date)}`:'Linked record unavailable';})} onSave={(patch)=>{
        const updated: Report={...report,updatedAt:new Date().toISOString(),ratings:{...report.ratings,[category]:{...entry,...patch,nrtOfficeReviewStatus:'responded',nrtOfficeRespondedAt:new Date().toISOString()}}};
        upsertReport(updated);
      }}/>)}</ul>}
  </Panel>;
}

function ReviewCard({report,category,entry,references,onSave}:{report:Report;category:Category;entry:RatingEntry;references:string[];onSave(patch:Partial<RatingEntry>):void}) {
  const [action,setAction]=useState<RatingEntry['nrtOfficeAction']>(entry.nrtOfficeAction??'accepted_meeting');
  const [response,setResponse]=useState(entry.nrtOfficeResponse??'');
  return <li className="grid gap-3 p-4" data-testid={`row-nrt-review-${report.id}-${category}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-bold">PO {report.recruitName}#{report.recruitBadge} · {CATEGORY_LABEL[category]}</h3><p className="text-xs text-muted-foreground">{formatDateDMY(report.date)} · Phase {report.phase} · FTO {report.ftoName}#{report.ftoBadge}</p></div>
      <span className="rounded border bg-card px-2 py-1 text-xs font-semibold">NRT submitted for review</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded border bg-muted/25 p-3 text-sm"><b>Why NRT was selected</b><p className="mt-1 whitespace-pre-wrap">{entry.justification||'No explanation provided.'}</p></div>
      <div className="rounded border bg-muted/25 p-3 text-sm"><b>Corrective actions and retraining</b><p className="mt-1 whitespace-pre-wrap">{entry.nrtCorrectiveActions||'No corrective actions documented.'}</p></div>
    </div>
    <div className="rounded border p-3 text-sm"><b>Earlier UA references</b><p className="mt-1 mono text-xs">{references.join('; ')||'No earlier UA linked.'}</p></div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <label className="grid gap-1 text-sm font-semibold">FTO Office response
        <SearchableSelect value={action} onChange={event=>setAction(event.target.value as RatingEntry['nrtOfficeAction'])} className="h-11 min-w-0 rounded border bg-card px-3 text-sm" data-testid={`select-nrt-action-${report.id}-${category}`}>
          {ACTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </SearchableSelect>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Response note
        <textarea rows={2} value={response} onChange={event=>setResponse(event.target.value)} className="min-h-20 w-full rounded border bg-card p-3 text-sm font-normal" placeholder="Add meeting or follow-up details." data-testid={`input-nrt-response-${report.id}-${category}`}/>
      </label>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={()=>onSave({nrtOfficeAction:action,nrtOfficeResponse:response})} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid={`button-save-nrt-response-${report.id}-${category}`}><CheckCircle2 className="h-4 w-4"/>Save local response</button>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareMore className="h-4 w-4"/>Local response only; no notification is sent.</span>
    </div>
  </li>;
}
