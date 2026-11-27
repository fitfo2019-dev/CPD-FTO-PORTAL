import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { PhaseCaseFolder, Report } from '@/lib/model.js';
import { buildIncentiveRows } from '@/lib/fto-incentive.js';
import { Panel } from '@/components/bits.js';
import { useToast } from '@/hooks/use-toast.js';

const PHASES = [{ value: 1, label: 'Phase I' }, { value: 2, label: 'Phase II' }, { value: 3, label: 'Phase III' }, { value: 4, label: 'Phase IV' }];

export function IncentiveReportPanel({ reports, folders }: { reports: readonly Report[]; folders: readonly PhaseCaseFolder[] }) {
  const { toast } = useToast();
  const classes = useMemo(() => [...new Set([...folders.map(f => f.className), ...reports.map(r => r.className)]
    .map(name => (name ?? '').trim()).filter(Boolean))].sort(), [reports, folders]);
  const [className, setClassName] = useState('');
  const [phase, setPhase] = useState(1);
  const selected = className || classes[0] || '';
  const rows = useMemo(() => (selected ? buildIncentiveRows(reports, folders, selected, phase) : []), [reports, folders, selected, phase]);

  return <Panel title="FTO Incentive Report" className="mb-4">
    <div className="flex flex-wrap items-end gap-3 p-4 text-sm" data-testid="panel-incentive-report">
      <label className="grid gap-1"><span className="label-caps">Class</span>
        <select className="h-10 min-w-48 rounded border bg-card px-2" value={selected} onChange={e => setClassName(e.target.value)} disabled={!classes.length} data-testid="select-incentive-class">
          {classes.length ? classes.map(name => <option key={name} value={name}>{name}</option>) : <option value="">None</option>}
        </select>
      </label>
      <label className="grid gap-1"><span className="label-caps">Phase</span>
        <select className="h-10 rounded border bg-card px-2" value={phase} onChange={e => setPhase(Number(e.target.value))} data-testid="select-incentive-phase">
          {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <span className="mono pb-2 text-xs text-muted-foreground" data-testid="text-incentive-count">{rows.length} FTO · {rows.filter(r => r.fullPhase).length} full phase</span>
      <button type="button" className="ml-auto inline-flex h-10 items-center gap-1.5 rounded border bg-card px-3 font-bold uppercase tracking-wider hover:bg-muted disabled:opacity-50"
        disabled={!selected} onClick={() => { void import('@/lib/fto-incentive-workbook.js').then(({ exportIncentiveWorkbook }) => { const filename = exportIncentiveWorkbook(rows, selected, phase); toast({ title: 'Excel exported', description: filename }); }).catch(() => toast({ title: 'Excel export unavailable', description: 'Reconnect and try again.', variant: 'destructive' })); }}
        data-testid="button-export-incentive"><FileSpreadsheet className="h-4 w-4" />Export Excel</button>
    </div>
  </Panel>;
}
