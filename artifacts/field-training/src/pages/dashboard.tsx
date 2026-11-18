import { Link } from 'wouter';
import { ArrowRight, AlertTriangle, PenLine } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { CATEGORIES, CATEGORY_LABEL, isBelowStandard, needsJustification, ROLE_LABEL } from '@/lib/model';
import { PageHead, Panel, Stat, StatusPill, RatingChip } from '@/components/bits';

export default function Dashboard() {
  const { ws } = useWorkspace();
  const R = ws.reports;
  const sorted = [...R].sort((a,b) => b.date.localeCompare(a.date));
  const awaiting = { fto: R.filter(r => r.status==='draft').length, recruit: R.filter(r => r.status==='fto_signed').length, sergeant: R.filter(r => r.status==='recruit_signed').length };
  const locked = R.filter(r => r.status==='locked').length;
  const hours = R.reduce((a,r)=>a+r.hours,0), calls = R.reduce((a,r)=>a+r.calls,0);
  const flags = R.flatMap(r => CATEGORIES.filter(c => { return isBelowStandard(r.ratings[c].rating); }).map(c => ({ r, c })));
  const doneTasks = ws.tasks.filter(t=>t.done).length;
  const curPhase = Math.max(1, ...R.map(r=>r.phase));
  const mine = ws.role === 'admin' ? 0 : awaiting[ws.role];

  return (
    <div>
      <PageHead kicker={'Supervisor overview · viewing as ' + ROLE_LABEL[ws.role] + ' (demo)'} title="Recruit Sam Example · Badge 0001">
        <Link href="/reports/new" data-testid="link-new-dor" className="h-10 px-4 rounded bg-accent text-accent-foreground font-bold text-sm inline-flex items-center gap-2 hover:brightness-95 active:scale-[.98] transition"><PenLine className="h-4 w-4" />New daily report</Link>
      </PageHead>

      {mine > 0 && <div className="rise mb-4 rounded-md border-l-4 border-accent bg-card border p-3 text-sm flex items-center gap-2" data-testid="text-my-queue"><AlertTriangle className="h-4 w-4 text-warn" /><b className="mono">{mine}</b> report{mine>1?'s':''} waiting on the {ROLE_LABEL[ws.role]} step.<Link href="/reports" className="ml-auto font-semibold underline">Open queue</Link></div>}

      <Panel className="grid grid-cols-2 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 mb-4">
        <Stat label="Reports" value={R.length} sub={locked + ' locked'} />
        <Stat label="Current phase" value={curPhase} sub={curPhase === 5 ? 'Shadow phase' : 'of 4 + shadow'} />
        <Stat label="Hours logged" value={hours} sub={calls + ' calls handled'} />
        <Stat label="Tasks signed" value={doneTasks + '/' + ws.tasks.length} sub={(ws.tasks.length - doneTasks) + ' remaining'} />
        <Stat label="Below standard" value={flags.length} sub="UA or NRT ratings" tone={flags.length ? 'bad' : undefined} />
        <Stat label="Awaiting signature" value={awaiting.fto + awaiting.recruit + awaiting.sergeant} sub={'FTO ' + awaiting.fto + ' · Rec ' + awaiting.recruit + ' · Sgt ' + awaiting.sergeant} tone="warn" />
      </Panel>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Panel title="Recent daily observation reports" action={<Link href="/reports" className="text-xs font-semibold inline-flex items-center gap-1 hover:underline" data-testid="link-all-reports">All <ArrowRight className="h-3 w-3" /></Link>}>
          {sorted.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No reports yet. Start one between calls.</div> :
          <ul className="divide-y">{sorted.slice(0,6).map(r => (
            <li key={r.id}><Link href={'/reports/' + r.id} data-testid={'row-recent-' + r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors group">
              <div className="mono text-xs w-20 shrink-0"><div className="font-bold">{r.number}</div><div className="text-muted-foreground">{r.date.slice(5)}</div></div>
              <div className="hidden sm:flex gap-1">{CATEGORIES.map(c => <RatingChip key={c} r={r.ratings[c].rating} />)}</div>
              <div className="ml-auto flex items-center gap-2"><StatusPill s={r.status} /><ArrowRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" /></div>
            </Link></li>))}
          </ul>}
        </Panel>
        <div className="space-y-4">
          <Panel title="Ratings by report date">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left"><th className="label-caps px-4 py-2">Date</th>{CATEGORIES.map(k=><th key={k} className="label-caps px-1 py-2" title={CATEGORY_LABEL[k]}>{CATEGORY_LABEL[k].slice(0,2)}</th>)}</tr></thead>
              <tbody className="divide-y">{sorted.map(r => (
                <tr key={r.id}><td className="px-4 py-2 mono whitespace-nowrap"><Link href={'/reports/'+r.id} className="hover:underline">{r.date}</Link></td>{CATEGORIES.map(k=><td key={k} className="px-1 py-2"><RatingChip r={r.ratings[k].rating} /></td>)}</tr>))}
              </tbody></table></div>
            <p className="px-4 py-2 border-t text-xs text-muted-foreground">NO Not Observed · A Acceptable · RT Responding to Training · UA Unacceptable · NRT Not Responding to Training. Ratings are never averaged.</p>
          </Panel>
          <Panel title="Flagged for remediation">
            {flags.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No below-standard ratings in current records.</p> :
            <ul className="divide-y text-sm">{flags.map(({r,c}) => (
              <li key={r.id+c} className="px-4 py-2.5 flex gap-3 items-start"><RatingChip r={r.ratings[c].rating} /><div className="min-w-0"><div className="font-semibold">{CATEGORY_LABEL[c]} · <Link href={'/reports/'+r.id} className="mono underline">{r.number}</Link></div>{needsJustification(r.ratings[c].rating) && <p className="text-muted-foreground line-clamp-2">{r.ratings[c].justification || 'Justification missing'}</p>}</div></li>))}
            </ul>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
