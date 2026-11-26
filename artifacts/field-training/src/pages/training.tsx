import { useState } from 'react';
import { Check } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { PageHead, Panel } from '@/components/bits.js';
import { cn } from '@/lib/utils.js';
import { PHASES, phaseLabel, type Phase } from '@/lib/model.js';
import { formatDateTimeMDY } from '@/lib/training-calendar.js';

export default function Training() {
  const { ws, toggleTask } = useWorkspace();
  const [phase, setPhase] = useState<Phase>(1);
  const canSign = ws.role === 'fto';
  const by = ws.caseFolder ? `${ws.caseFolder.ftoName} (${ws.caseFolder.ftoBadge}) · device-local` : 'Device-local · no verified signer';
  const tasks = ws.tasks.filter(t => t.phase === phase);
  const groups = Array.from(new Set(tasks.map(t => t.group)));
  return (
    <div className="max-w-4xl">
      <PageHead kicker="Phase competency tasks" title={phaseLabel(phase)} photo="new-officers" stats={ws.tasks.length ? [
        { label: 'Tasks Complete', value: `${ws.tasks.filter(t => t.done).length} / ${ws.tasks.length}`, testId: 'hero-tasks-complete' },
      ] : undefined} />
      <div className="rise grid grid-cols-3 sm:grid-cols-5 gap-1 mb-4" role="tablist">{PHASES.map(p => { const all = ws.tasks.filter(t=>t.phase===p); const d = all.filter(t=>t.done).length; return (
        <button key={p} role="tab" aria-selected={phase===p} data-testid={'tab-phase-' + p} onClick={()=>setPhase(p)} className={cn('rounded border p-3 text-left transition', phase===p ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted')}>
          <div className="text-xs font-bold uppercase tracking-wider opacity-80">{phaseLabel(p)}</div><div className="mono text-xl font-bold">{d}/{all.length}</div>
        </button>); })}</div>
      {!canSign && <p className="rise mb-3 text-sm rounded border bg-card p-3">Training completion is read-only for this role. The assigned FTO records completion.</p>}
      <div className="space-y-4">{groups.map(g => (
        <Panel key={g} title={g}>
          <ul className="divide-y">{tasks.filter(t=>t.group===g).map(t => (
            <li key={t.id}><button data-testid={'task-' + t.id} disabled={!canSign} onClick={()=>toggleTask(t.id, by)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition disabled:cursor-default disabled:hover:bg-transparent">
              <span className={cn('h-6 w-6 rounded-sm border-2 grid place-items-center shrink-0 transition', t.done ? 'bg-primary border-primary text-primary-foreground scale-100' : 'border-input')}>{t.done && <Check className="h-4 w-4" />}</span>
              <span className={cn('flex-1 text-sm', t.done && 'font-medium')}>{t.title}</span>
              {t.done && t.at && <span className="text-xs text-muted-foreground mono text-right hidden sm:block">{t.by}<br />{formatDateTimeMDY(t.at).slice(0,10)}</span>}
            </button></li>))}</ul>
        </Panel>))}</div>
    </div>
  );
}
