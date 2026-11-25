import type {PacketSubmission,PacketSubmissionState,PacketSubmissionDetail} from '@workspace/api-client-react';
import {CATEGORY_LABEL,type Category} from '@/lib/model.js';

export const STATE_LABEL:Record<PacketSubmissionState,string>={
  submitted:'SUBMITTED',acknowledged:'PACKET ACKNOWLEDGE',approved:'COMPLETE',correction_requested:'CORRECTION REQUESTED',withdrawn:'WITHDRAWN',
};
const STATE_TONE:Record<PacketSubmissionState,string>={
  submitted:'border-primary text-primary',acknowledged:'border-[hsl(var(--warn))] text-warn',
  approved:'border-[hsl(var(--ok))] text-ok',correction_requested:'border-destructive text-destructive',withdrawn:'border-destructive text-destructive',
};
export function StatusTag({state}:{state:PacketSubmissionState}) {
  return <span data-testid={`status-packet-${state}`} className={`inline-block border-2 px-2 py-0.5 text-[0.68rem] font-bold tracking-[0.12em] ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
}
export const when=(value:string|null)=>value?new Date(value).toLocaleString():'—';

const humanize=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
function Value({value}:{value:unknown}) {
  if(value===null||value===undefined||value==='') return <span className="text-muted-foreground">—</span>;
  if(typeof value==='boolean') return <span>{value?'Yes':'No'}</span>;
  if(typeof value==='string'||typeof value==='number') return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  if(Array.isArray(value)) return value.length===0?<span className="text-muted-foreground">None</span>:
    <ol className="list-decimal space-y-1 pl-5">{value.map((item,i)=><li key={i}><Value value={item}/></li>)}</ol>;
  return <Fields data={value as Record<string,unknown>}/>;
}
export function Fields({data}:{data:Record<string,unknown>}) {
  const entries=Object.entries(data);
  if(!entries.length) return <p className="text-sm text-muted-foreground">No entries recorded.</p>;
  return <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(10rem,14rem)_1fr]">
    {entries.map(([k,v])=><div key={k} className="contents"><dt className="font-semibold text-foreground">{humanize(k)}</dt><dd className="min-w-0"><Value value={v}/></dd></div>)}
  </dl>;
}
function Section({title,children}:{title:string;children:React.ReactNode}) {
  return <section className="border border-border bg-card p-4"><h3 className="label-caps mb-3">{title}</h3>{children}</section>;
}
function Narrative({label,text}:{label:string;text:string}) {
  return <div><p className="label-caps mb-1">{label}</p>
    {text?<p className="whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-sm text-foreground">{text}</p>:<p className="text-sm text-muted-foreground">Not entered.</p>}</div>;
}

export function PacketDocument({detail}:{detail:PacketSubmissionDetail}) {
  const {report,submission,history}=detail;
  const {id:_id,date,phase,className,recruitName,recruitBadge,ftoName,ftoBadge,runs,activity,reportingForDuty,ratings,status:_s,narrative,remedial,recruitComments,...rest}=report;
  void _id;void _s;
  const header={date,phase,className,recruitName,recruitBadge,ftoName,ftoBadge,
    ...Object.fromEntries(Object.entries(rest).filter(([k,v])=>['shift','shiftStartTime','zone','precinct','cruiserDistrict','ftoAssignment','phaseWeek','ftoWeek','limboDay'].includes(k)&&v!==undefined))};
  const HEADER_KEYS=['shift','shiftStartTime','zone','precinct','cruiserDistrict','ftoAssignment','phaseWeek','ftoWeek','limboDay'];
  const TRANSPORT=['syncStatus','serverVersion'];
  const notes=Object.fromEntries(Object.entries(rest).filter(([k,v])=>!HEADER_KEYS.includes(k)&&!TRANSPORT.includes(k)&&v!==undefined));
  return <div className="space-y-3" data-testid="packet-document">
    <Section title="Daily Report Header"><Fields data={header}/></Section>
    <Section title="Reporting for Duty Checklist"><Fields data={reportingForDuty}/></Section>
    <Section title={`Runs · ${runs.length}`}>
      {runs.length===0?<p className="text-sm text-muted-foreground">No runs recorded on this packet.</p>:
        <div className="space-y-3">{runs.map((run,i)=><div key={i} className="border-l-4 border-primary/50 bg-background p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">Run {i+1}</p><Fields data={run}/></div>)}</div>}
    </Section>
    <Section title="Daily Activity"><Fields data={activity}/></Section>
    <Section title="SEG Ratings">
      {Object.keys(ratings).length===0?<p className="text-sm text-muted-foreground">No ratings recorded.</p>:
      <table className="w-full text-sm"><thead><tr className="text-left"><th className="py-1 pr-3">Category</th><th className="py-1 pr-3">Rating</th><th className="py-1 pr-3">Justification</th><th className="py-1">Additional Detail</th></tr></thead>
        <tbody>{Object.entries(ratings).map(([k,v])=>{const e=(v&&typeof v==='object'?v:{rating:v}) as {rating?:unknown;justification?:unknown}&Record<string,unknown>;
          const {rating:_r,justification:_j,...extra}=e;void _r;void _j;
          return <tr key={k} className="border-t border-border align-top"><td className="py-1.5 pr-3">{CATEGORY_LABEL[k as Category]??humanize(k)}</td>
            <td className="py-1.5 pr-3 font-semibold mono">{String(e.rating??'—')}</td><td className="py-1.5 pr-3 whitespace-pre-wrap">{String(e.justification??'')}</td>
            <td className="py-1.5">{Object.keys(extra).length?<Fields data={extra}/>:<span className="text-muted-foreground">—</span>}</td></tr>;})}</tbody></table>}
    </Section>
    <Section title="Narratives"><div className="space-y-3">
      <Narrative label="FTO Narrative" text={narrative}/><Narrative label="Remedial Training" text={remedial}/><Narrative label="Recruit Comments" text={recruitComments}/></div></Section>
    {Object.keys(notes).length>0&&<Section title="Additional Report Detail"><Fields data={notes}/></Section>}
    <Section title="Coordinator Review Note">
      {submission.review_note?<p className="whitespace-pre-wrap text-sm">{submission.review_note}</p>:<p className="text-sm text-muted-foreground">No review note.</p>}
    </Section>
    <Section title="Audit History">
      {history.length===0?<p className="text-sm text-muted-foreground">No history returned by the server.</p>:
      <ol className="space-y-2">{history.map((h,i)=><li key={i} className="border-l-2 border-border pl-3 text-sm" data-testid={`row-history-${i}`}>
        <span className="font-bold uppercase tracking-[0.08em]">{h.action.replaceAll('_',' ')}</span> <span className="mono text-xs text-muted-foreground">{when(h.occurred_at)}</span>
        {h.note&&<p className="whitespace-pre-wrap">{h.note}</p>}</li>)}</ol>}
    </Section>
  </div>;
}
export type {PacketSubmission};
