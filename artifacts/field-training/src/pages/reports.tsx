import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, PenLine, X } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { CATEGORIES, PHASES, phaseLabel, STATUS_LABEL, isBelowStandard, type Status } from '@/lib/model';
import { PageHead, Panel, StatusPill, RatingChip } from '@/components/bits';

export default function Reports() {
  const { ws } = useWorkspace();
  const [q, setQ] = useState(''); const [status, setStatus] = useState<'' | Status>(''); const [phase, setPhase] = useState(''); const [shift, setShift] = useState(''); const [flagged, setFlagged] = useState(false);
  const list = useMemo(() => ws.reports.filter(r => {
    if (status && r.status !== status) return false;
    if (phase && String(r.phase) !== phase) return false;
    if (shift && r.shift !== shift) return false;
    if (flagged && !CATEGORIES.some(c => isBelowStandard(r.ratings[c].rating))) return false;
    if (q) { const hay = [r.number, r.date, r.precinct, r.beat, r.recruitComments, r.ftoName, r.recruitName, r.narrative, r.remedial, ...CATEGORIES.map(c=>r.ratings[c].justification)].join(' ').toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date)), [ws.reports, q, status, phase, shift, flagged]);
  const active = !!(q || status || phase || shift || flagged);
  const sel = 'h-10 rounded border bg-card px-2 text-sm';

  return (
    <div>
      <PageHead kicker="Daily observation reports" title={list.length + ' of ' + ws.reports.length + ' reports'}>
        <Link href="/reports/new" data-testid="link-new-dor" className="h-10 px-4 rounded bg-accent text-accent-foreground font-bold text-sm inline-flex items-center gap-2"><PenLine className="h-4 w-4" />New DOR</Link>
      </PageHead>
      <div className="rise flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-search" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search number, beat, narrative, justification" className="h-10 w-full rounded border bg-card pl-9 pr-3 text-sm" /></div>
        <select data-testid="select-status" className={sel} value={status} onChange={e=>setStatus(e.target.value as Status|'')}><option value="">All statuses</option>{(Object.keys(STATUS_LABEL) as Status[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select data-testid="select-phase" className={sel} value={phase} onChange={e=>setPhase(e.target.value)}><option value="">All phases</option>{PHASES.map(p=><option key={p} value={p}>{phaseLabel(p)}</option>)}</select>
        <select data-testid="select-shift" className={sel} value={shift} onChange={e=>setShift(e.target.value)}><option value="">All shifts</option>{['Day','Swing','Night'].map(s=><option key={s}>{s}</option>)}</select>
        <label className="h-10 px-3 rounded border bg-card text-sm flex items-center gap-2 cursor-pointer"><input data-testid="checkbox-flagged" type="checkbox" checked={flagged} onChange={e=>setFlagged(e.target.checked)} />UA / NRT only</label>
        {active && <button data-testid="button-clear-filters" onClick={()=>{setQ('');setStatus('');setPhase('');setShift('');setFlagged(false);}} className="h-10 px-3 text-sm font-semibold inline-flex items-center gap-1 hover:underline"><X className="h-4 w-4" />Clear</button>}
      </div>
      <Panel>
        {list.length === 0 ? (
          <div className="p-10 text-center"><div className="mono text-4xl font-bold text-muted-foreground">0</div><p className="mt-2 text-sm text-muted-foreground">{active ? 'No reports match these filters.' : 'No reports yet.'}</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-muted/60"><tr className="text-left">{['Report','Date / shift','Phase','Precinct / beat','Ratings Ap·At·Kn·Pe·Re','Hrs / calls','Status'].map(h=><th key={h} className="label-caps px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map(r => { return (
              <tr key={r.id} className="hover:bg-muted/50 transition-colors" data-testid={'row-report-' + r.id}>
                <td className="px-3 py-2.5"><Link href={'/reports/'+r.id} className="mono font-bold underline-offset-2 hover:underline">{r.number}</Link></td>
                <td className="px-3 py-2.5 mono whitespace-nowrap">{r.date} <span className="text-muted-foreground">· {r.shift}</span></td>
                <td className="px-3 py-2.5 mono">{r.phase===5?'S':r.phase}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{r.precinct} · {r.beat}</td>
                <td className="px-3 py-2.5"><div className="flex gap-1">{CATEGORIES.map(c=><RatingChip key={c} r={r.ratings[c].rating} />)}</div></td>
                <td className="px-3 py-2.5 mono">{r.hours} / {r.calls}</td>
                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
