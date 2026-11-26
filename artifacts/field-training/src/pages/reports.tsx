import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, PenLine, X } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { CATEGORIES, PHASES, phaseAssignmentLabel, phaseLabel, SHIFTS, SHIFT_LABEL, shiftCodeLabel, STATUS_LABEL, evaluationProgress, type Status } from '@/lib/model.js';
import { PageHead, Panel, StatusPill } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { activityTotals } from '@/lib/run-activity.js';
import { PacketTransferPanel } from '@/components/packet-transfer-panel.js';
import { SavedIncidentSearch } from '@/components/saved-incident-search.js';

export default function Reports() {
  const { ws, vault, previewOnly } = useWorkspace();
  const [q, setQ] = useState(''); const [status, setStatus] = useState<'' | Status>(''); const [phase, setPhase] = useState(''); const [shift, setShift] = useState(''); const [flagged, setFlagged] = useState(false);
  const list = useMemo(() => ws.reports.filter(r => {
    if (status && r.status !== status) return false;
    if (phase && String(r.phase) !== phase) return false;
    if (shift && r.shift !== shift) return false;
    if (flagged && !CATEGORIES.some(c => ['UA','NRT'].includes(r.ratings[c].rating))) return false;
    if (q) { const hay = [r.date, formatDateDMY(r.date), r.zone, r.precinct, r.cruiserDistrict, r.ftoAssignment, r.recruitComments, r.ftoName, r.recruitName, r.narrative, r.remedial, ...CATEGORIES.map(c=>r.ratings[c].justification)].join(' ').toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date)), [ws.reports, q, status, phase, shift, flagged]);
  const active = !!(q || status || phase || shift || flagged);
  const sel = 'h-10 rounded border bg-card px-2 text-sm';

  return (
    <div>
      <PageHead kicker="Saved shift records · Daily Performance Summary · U-10.174" title={list.length + ' of ' + ws.reports.length + ' records'}>
        <Link href="/agency-packets" className="h-10 px-4 rounded border bg-card font-bold text-sm inline-flex items-center gap-2">Agency packet review</Link>
        <Link href="/reports/weekly-summary" data-testid="link-weekly-summary" className="h-10 px-4 rounded border bg-card font-bold text-sm inline-flex items-center gap-2">Weekly Performance Summary · U-10.173</Link>
        <Link href="/reports/monthly-summary" data-testid="link-monthly-summary" className="h-10 px-4 rounded border bg-card font-bold text-sm inline-flex items-center gap-2">Monthly Performance Summary</Link>
        <Link href="/reports/weekly-ack" data-testid="link-weekly-acknowledgement" className="h-10 px-4 rounded border bg-card font-bold text-sm inline-flex items-center gap-2">Weekly Packet Acknowledgement</Link>
        <Link href="/reports/new" data-testid="link-new-log" className="h-10 px-4 rounded bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2"><PenLine className="h-4 w-4" />Start shift</Link>
      </PageHead>
      <PacketTransferPanel key={`${ws.role}:${vault}:${previewOnly}`} />
      <div className="rise flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-search" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search PO, zone, precinct, FTO assignment, narrative" className="h-10 w-full rounded border bg-card pl-9 pr-3 text-sm" /></div>
        <SearchableSelect data-testid="select-status" className={sel} value={status} onChange={e=>setStatus(e.target.value as Status|'')}><option value="">All statuses</option>{(Object.keys(STATUS_LABEL) as Status[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</SearchableSelect>
        <SearchableSelect data-testid="select-phase" className={sel} value={phase} onChange={e=>setPhase(e.target.value)}><option value="">All phases</option>{PHASES.map(p=><option key={p} value={p}>{phaseLabel(p)}</option>)}</SearchableSelect>
        <SearchableSelect data-testid="select-shift" className={sel} value={shift} onChange={e=>setShift(e.target.value)}><option value="">All shifts</option>{SHIFTS.map(s=><option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}</SearchableSelect>
         <label className="h-10 px-3 rounded border bg-card text-sm flex items-center gap-2 cursor-pointer"><input data-testid="checkbox-flagged" type="checkbox" checked={flagged} onChange={e=>setFlagged(e.target.checked)} />Unacceptable / NRT follow-up</label>
        {active && <button data-testid="button-clear-filters" onClick={()=>{setQ('');setStatus('');setPhase('');setShift('');setFlagged(false);}} className="h-10 px-3 text-sm font-semibold inline-flex items-center gap-1 hover:underline"><X className="h-4 w-4" />Clear</button>}
      </div>
      <SavedIncidentSearch reports={ws.reports} />
      <Panel>
        {list.length === 0 ? (
          <div className="p-10 text-center"><div className="mono text-4xl font-bold text-muted-foreground">0</div><p className="mt-2 text-sm text-muted-foreground">{active ? 'No reports match these filters.' : 'No reports yet.'}</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-muted/60"><tr className="text-left">{['Probationary Officer','Date / shift','Phase','FTO assignment','Evaluation','Activity counts','Status'].map(h=><th key={h} className="label-caps px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
             <tbody className="divide-y">{list.map(r => (
              <tr key={r.id} className="hover:bg-muted/50 transition-colors" data-testid={'row-report-' + r.id}>
                <td className="px-3 py-2.5"><Link href={'/reports/'+r.id} className="font-bold underline-offset-2 hover:underline">PO {r.recruitName} #{r.recruitBadge}</Link></td>
                <td className="px-3 py-2.5 mono whitespace-nowrap">{formatDateDMY(r.date)} <span className="text-muted-foreground">· {shiftCodeLabel(r.shift)}</span></td>
                 <td className="px-3 py-2.5">{phaseLabel(r.phase)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{phaseAssignmentLabel(r.ftoAssignment,r.shift,r.cruiserDistrict)}</td>
                 <td className="px-3 py-2.5">{evaluationProgress(r)}</td>
                 <td className="px-3 py-2.5 mono">{Object.values(activityTotals(r)).reduce((sum, count) => sum + count, 0)}</td>
                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
               </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
