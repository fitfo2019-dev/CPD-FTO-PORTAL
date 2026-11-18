import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ShieldAlert, Lock, PenTool, Trash2, Check, Info } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { CATEGORIES, CATEGORY_HINT, CATEGORY_LABEL, PHASES, phaseLabel, RATINGS, RATING_NAME, ROLE_LABEL, needsJustification, ratingLabel, scanPII, uid, validateReport, type Rating, type Report, type Role } from '@/lib/model';
import { PageHead, Panel, StatusPill } from '@/components/bits';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function blank(n: number): Report {
  const now = new Date().toISOString();
  return { id: uid(), number: 'DOR-' + String(n).padStart(4,'0'), date: now.slice(0,10), shift:'Day', phase:2, precinct:'Sample Precinct North', recruitName:'Recruit Sam Example', recruitBadge:'0001', ftoName:'Officer John Doe', ftoBadge:'0000', sergeantName:'Sgt. Jane Sample', beat:'Sample Beat 1', hours:10, calls:0,
    ratings: Object.fromEntries(CATEGORIES.map(c=>[c,{rating:'' as Rating, justification:''}])) as Report['ratings'], narrative:'', remedial:'', recruitComments:'', status:'draft', signatures:{}, createdAt: now, updatedAt: now };
}
const STEPS: { role: Role; key: 'fto'|'recruit'|'sergeant'; from: Report['status']; to: Report['status']; verb: string }[] = [
  { role:'fto', key:'fto', from:'draft', to:'fto_signed', verb:'Sign as FTO' },
  { role:'recruit', key:'recruit', from:'fto_signed', to:'recruit_signed', verb:'Acknowledge as Recruit' },
  { role:'sergeant', key:'sergeant', from:'recruit_signed', to:'locked', verb:'Approve & lock as Sergeant' },
];

export default function ReportEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'new';
  const { ws, upsertReport, deleteReport, setEditorDirty } = useWorkspace();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const existing = isNew ? undefined : ws.reports.find(r => r.id === params.id);
  const [r, setR] = useState<Report | undefined>(() => existing ? structuredClone(existing) : isNew ? blank(ws.reports.length + 1) : undefined);
  const [showErr, setShowErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [sigStep, setSigStep] = useState<typeof STEPS[number] | null>(null);
  const [sigName, setSigName] = useState('');

  const baseline = useMemo(() => JSON.stringify(existing ?? null), [existing]);
  const isDirty = !!r && (isNew ? r.status === 'draft' && (r.narrative !== '' || CATEGORIES.some(c => r.ratings[c].rating !== '')) : JSON.stringify(r) !== baseline);
  useEffect(() => { setEditorDirty(isDirty); }, [isDirty, setEditorDirty]);
  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);
  const errs = useMemo(() => r ? validateReport(r) : [], [r]);
  const pii = useMemo(() => r ? Array.from(new Set(scanPII([r.narrative, r.remedial, r.recruitComments, r.precinct, r.beat, ...CATEGORIES.map(c=>r.ratings[c].justification)].join('\n')))) : [], [r]);

  if (!r) return <div className="py-20 text-center"><div className="mono text-5xl font-bold text-muted-foreground">404</div><p className="mt-2">Report not found in this workspace.</p><Link href="/reports" className="underline font-semibold mt-3 inline-block">Back to reports</Link></div>;

  const locked = r.status === 'locked';
  const editable = r.status === 'draft' && ws.role === 'fto';
  const commentsEditable = r.status === 'fto_signed' && ws.role === 'recruit';
  const set = <K extends keyof Report>(k: K, v: Report[K]) => setR(x => x && ({ ...x, [k]: v }));
  const setRating = (c: typeof CATEGORIES[number], patch: Partial<Report['ratings'][typeof c]>) => setR(x => x && ({ ...x, ratings: { ...x.ratings, [c]: { ...x.ratings[c], ...patch } } }));

  function save() {
    if (!r) return;
    const next = { ...r, updatedAt: new Date().toISOString() };
    upsertReport(next); setR(next);
    toast({ title: 'Draft updated in workspace', description: 'Use "Save locally" to encrypt it on this device.' });
    if (isNew) nav('/reports/' + next.id, { replace: true });
  }
  function sign() {
    if (!r || !sigStep) return;
    if (errs.length) { setShowErr(true); setSigStep(null); return; }
    const badge = sigStep.key === 'fto' ? r.ftoBadge : sigStep.key === 'recruit' ? r.recruitBadge : '9999';
    const next: Report = { ...r, status: sigStep.to, signatures: { ...r.signatures, [sigStep.key]: { name: sigName.trim(), badge, at: new Date().toISOString() } }, updatedAt: new Date().toISOString() };
    upsertReport(next); setR(next); setSigStep(null); setSigName('');
    toast({ title: 'Demonstration signature recorded', description: 'Typed name only. Identity is not verified.' });
    if (isNew) nav('/reports/' + next.id, { replace: true });
  }
  const nextStep = STEPS.find(s => s.from === r.status);
  const expectedName = nextStep ? (nextStep.key==='fto' ? r.ftoName : nextStep.key==='recruit' ? r.recruitName : r.sergeantName) : '';
  const inp = 'h-10 w-full rounded border bg-card px-3 text-sm disabled:opacity-70';

  return (
    <div className="max-w-5xl">
      <Link href="/reports" className="text-sm font-semibold inline-flex items-center gap-1 mb-2 hover:underline" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Reports</Link>
      <PageHead kicker={isNew ? 'New daily observation report' : 'Daily observation report'} title={r.number}>
        <StatusPill s={r.status} />
        {(editable || commentsEditable) && <button data-testid="button-save-draft" onClick={save} className="h-10 px-4 rounded bg-primary text-primary-foreground font-bold text-sm active:scale-[.98] transition">{commentsEditable ? 'Save comments' : 'Save draft'}{isDirty && ' *'}</button>}
        {!isNew && r.status === 'draft' && ws.role === 'fto' && <button data-testid="button-delete" onClick={()=>setConfirmDel(true)} className="h-10 px-3 rounded border text-sm text-destructive inline-flex items-center gap-1.5 hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Delete</button>}
      </PageHead>

      {ws.role === 'admin' && <div className="rise mb-3 text-sm rounded border bg-card p-3 flex gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0" />Admin demo view is read-only. Assignment management is a future module (see Settings).</div>}
      {ws.role !== 'admin' && !editable && !locked && <div className="rise mb-3 text-sm rounded border bg-card p-3 flex gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0" />{r.status === 'draft' ? 'Switch to the FTO demo role to edit this draft.' : r.status === 'fto_signed' ? 'Evaluation fields are frozen after the FTO signature. The Recruit may add comments before acknowledging.' : 'Fields are frozen. Remaining step is the sergeant signature.'}</div>}
      {locked && <div className="rise mb-3 text-sm rounded border border-foreground bg-foreground text-background p-3 flex gap-2"><Lock className="h-4 w-4 mt-0.5" />Locked by sergeant demonstration signature. Read-only.</div>}

      <div className="rise mb-4 rounded-md border-2 border-destructive/60 bg-destructive/5 p-3 text-sm flex gap-2" data-testid="warning-pii"><ShieldAlert className="h-5 w-5 text-destructive shrink-0" /><div><b>Do not enter suspect PII, criminal history, or restricted identifiers</b> (SSNs, DOBs, license numbers, case or booking numbers, records-system results). Describe the recruit's performance only. This is a fictional demo.
        {pii.length > 0 && <ul className="mt-1.5 font-semibold text-destructive list-disc pl-5" data-testid="list-pii-hits">{pii.map(p=><li key={p}>Possible: {p}. Remove before saving.</li>)}</ul>}</div></div>

      {showErr && errs.length > 0 && <div role="alert" className="rise mb-4 rounded border border-destructive bg-card p-3 text-sm" data-testid="list-errors"><b className="text-destructive">Required before any signature (drafts may be saved incomplete):</b><ul className="list-disc pl-5 mt-1">{errs.map(e=><li key={e}>{e}</li>)}</ul></div>}

      <Panel title="Shift metadata" className="mb-4">
        <fieldset disabled={!editable} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <F l="Report no."><input className={inp+' mono'} value={r.number} onChange={e=>set('number',e.target.value)} data-testid="input-number" /></F>
          <F l="Shift date"><input type="date" className={inp+' mono'} value={r.date} onChange={e=>set('date',e.target.value)} data-testid="input-date" /></F>
          <F l="Shift"><select className={inp} value={r.shift} onChange={e=>set('shift',e.target.value as Report['shift'])} data-testid="select-shift">{['Day','Swing','Night'].map(s=><option key={s}>{s}</option>)}</select></F>
          <F l="Phase"><select className={inp} value={r.phase} onChange={e=>set('phase',Number(e.target.value) as Report['phase'])} data-testid="select-phase">{PHASES.map(p=><option key={p} value={p}>{phaseLabel(p)}</option>)}</select></F>
          <F l="Recruit (fictional)"><input className={inp} value={r.recruitName} onChange={e=>set('recruitName',e.target.value)} data-testid="input-recruit" /></F>
          <F l="Recruit badge"><input className={inp+' mono'} value={r.recruitBadge} onChange={e=>set('recruitBadge',e.target.value)} data-testid="input-recruit-badge" /></F>
          <F l="FTO (fictional)"><input className={inp} value={r.ftoName} onChange={e=>set('ftoName',e.target.value)} data-testid="input-fto" /></F>
          <F l="FTO badge"><input className={inp+' mono'} value={r.ftoBadge} onChange={e=>set('ftoBadge',e.target.value)} data-testid="input-fto-badge" /></F>
          <F l="Sergeant (fictional)"><input className={inp} value={r.sergeantName} onChange={e=>set('sergeantName',e.target.value)} data-testid="input-sergeant" /></F>
          <F l="Precinct"><input className={inp} value={r.precinct} onChange={e=>set('precinct',e.target.value)} data-testid="input-precinct" /></F>
          <F l="Beat / area"><input className={inp} value={r.beat} onChange={e=>set('beat',e.target.value)} data-testid="input-beat" /></F>
          <F l="Hours"><input type="number" min={0} max={24} step={0.5} className={inp+' mono'} value={r.hours} onChange={e=>set('hours',Number(e.target.value))} data-testid="input-hours" /></F>
          <F l="Calls handled"><input type="number" min={0} className={inp+' mono'} value={r.calls} onChange={e=>set('calls',Number(e.target.value))} data-testid="input-calls" /></F>
        </fieldset>
      </Panel>

      <Panel title="Evaluation categories · NO Not Observed · A Acceptable · RT Responding to Training · UA Unacceptable · NRT Not Responding to Training" className="mb-4">
        <div className="divide-y">{CATEGORIES.map(c => { const v = r.ratings[c]; const need = needsJustification(v.rating); const short = need && v.justification.trim().length < 20; return (
          <div key={c} className="p-4 grid md:grid-cols-[180px_1fr] gap-3" data-testid={'category-' + c}>
            <div><div className="font-bold">{CATEGORY_LABEL[c]}</div><div className="text-xs text-muted-foreground">{CATEGORY_HINT[c]}</div></div>
            <div>
              <div role="radiogroup" aria-label={CATEGORY_LABEL[c]} className="flex flex-wrap gap-1">{RATINGS.map(x => (
                <button key={x} role="radio" aria-checked={v.rating===x} disabled={!editable} data-testid={'rating-' + c + '-' + x} onClick={()=>setRating(c,{rating: v.rating===x ? '' : x})}
                  className={cn('mono h-10 min-w-10 px-2 rounded border text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed', v.rating===x ? (x==='UA'||x==='NRT' ? 'bg-destructive text-destructive-foreground border-destructive' : x==='RT' ? 'bg-accent text-accent-foreground border-accent' : x==='NO' ? 'bg-muted text-foreground border-foreground' : 'bg-primary text-primary-foreground border-primary') : 'bg-card hover:bg-muted')} title={RATING_NAME[x]}>{ratingLabel(x)}<span className="hidden lg:inline font-normal font-sans ml-1.5 text-xs">{RATING_NAME[x]}</span></button>))}
              </div>
              {(need || v.rating === 'RT' || v.justification) && <div className="mt-2">
                <label className={cn('label-caps', need && 'text-destructive')}>{need ? 'Required justification for ' + RATING_NAME[v.rating as 'UA'] : v.rating === 'RT' ? 'Training notes (optional)' : 'Comment'}</label>
                <textarea disabled={!editable} data-testid={'input-justification-' + c} value={v.justification} onChange={e=>setRating(c,{justification:e.target.value})} rows={3} placeholder="Specific observed behavior, what was coached, and the recruit's response." className={cn('mt-1 w-full rounded border bg-card p-2.5 text-sm', short && showErr && 'border-destructive')} />
                {need && <div className={cn('text-xs mono', short ? 'text-destructive' : 'text-ok')}>{v.justification.trim().length}/20 min</div>}
              </div>}
            </div>
          </div>); })}</div>
      </Panel>

      <Panel title="Narrative" className="mb-4">
        <div className="p-4 grid gap-3">
          <F l="Shift narrative"><textarea disabled={!editable} rows={4} value={r.narrative} onChange={e=>set('narrative',e.target.value)} className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-narrative" /></F>
          <F l="Remedial training assigned"><textarea disabled={!editable} rows={2} value={r.remedial} onChange={e=>set('remedial',e.target.value)} className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-remedial" /></F>
        </div>
      </Panel>

      <Panel title="Recruit comments" className="mb-4">
        <div className="p-4">
          {commentsEditable ? <textarea rows={3} value={r.recruitComments} onChange={e=>set('recruitComments',e.target.value)} placeholder="Recruit's response to this evaluation (optional)." className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-recruit-comments" />
            : <p className="text-sm whitespace-pre-wrap" data-testid="text-recruit-comments">{r.recruitComments || <span className="text-muted-foreground">{r.status === 'draft' ? 'Recruit may comment after the FTO signs.' : r.status === 'fto_signed' ? 'Switch to the Recruit demo role to add comments.' : 'No comments provided.'}</span>}</p>}
          {r.recruitComments && r.signatures.recruit && <p className="mt-1 text-xs text-muted-foreground">Frozen at recruit acknowledgment.</p>}
        </div>
      </Panel>

      <Panel title="Demonstration signature chain — not verified identity">
        <ol className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">{STEPS.map((s,i) => { const sig = r.signatures[s.key]; const current = nextStep?.key === s.key; return (
          <li key={s.key} className={cn('p-4', current && 'bg-accent/10')} data-testid={'sig-' + s.key}>
            <div className="flex items-center gap-2"><span className={cn('mono h-6 w-6 rounded-full grid place-items-center text-xs font-bold border', sig ? 'bg-primary text-primary-foreground border-primary' : '')}>{sig ? <Check className="h-3.5 w-3.5" /> : i+1}</span><span className="font-bold">{ROLE_LABEL[s.role]}</span></div>
            {sig ? <div className="mt-2 text-sm"><div className="font-semibold">{sig.name} <span className="mono text-muted-foreground">#{sig.badge}</span></div><div className="mono text-xs text-muted-foreground">{new Date(sig.at).toLocaleString()}</div></div>
              : current ? (ws.role === s.role
                  ? <button data-testid={'button-sign-' + s.key} onClick={()=>{ if (errs.length) { setShowErr(true); return; } setSigStep(s); setSigName(''); }} className="mt-2 h-10 px-3 rounded bg-accent text-accent-foreground text-sm font-bold inline-flex items-center gap-1.5 active:scale-[.98] transition"><PenTool className="h-4 w-4" />{s.verb}</button>
                  : <p className="mt-2 text-sm text-muted-foreground">Waiting on {ROLE_LABEL[s.role]}. Switch demo role to continue.</p>)
              : <p className="mt-2 text-sm text-muted-foreground">Pending earlier step.</p>}
          </li>); })}</ol>
        <p className="px-4 py-2 border-t text-xs text-muted-foreground">Signatures are typed names stored with a timestamp. They do not prove identity and carry no legal weight in this demo.</p>
      </Panel>

      <AlertDialog open={!!sigStep} onOpenChange={o=>!o&&setSigStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{sigStep?.verb} (demonstration)</AlertDialogTitle>
            <AlertDialogDescription>Type the fictional name exactly: <b>{expectedName}</b>. This does not verify identity.{sigStep?.key==='fto' && ' Report fields will be frozen after this step.'}{sigStep?.key==='sergeant' && ' The report will be locked.'}</AlertDialogDescription></AlertDialogHeader>
          <input autoFocus data-testid="input-sign-name" value={sigName} onChange={e=>setSigName(e.target.value)} className={inp} placeholder={expectedName} />
          <AlertDialogFooter><AlertDialogCancel data-testid="button-sign-cancel">Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-sign-confirm" disabled={sigName.trim() !== expectedName} onClick={sign}>Record signature</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {r.number}?</AlertDialogTitle><AlertDialogDescription>This draft will be removed from the workspace.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-delete" onClick={()=>{ deleteReport(r.id); nav('/reports'); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function F({ l, children }: { l: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="label-caps">{l}</span>{children}</label>; }
