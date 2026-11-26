import { useMemo, useState } from 'react';
import { Redirect } from 'wouter';
import { PageHead, Panel, caseSafe } from '@/components/bits.js';
import { useWorkspace } from '@/state/workspace.js';

export default function FtoDirectoryPage() {
  const { ws } = useWorkspace();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...ws.ftoDirectory]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.badge.toLowerCase().includes(q) || (f.email ?? '').toLowerCase().includes(q))
      .map(f => {
        const mine = ws.assignments.filter(a => a.ftoBadge.toLowerCase() === f.badge.toLowerCase());
        return { ...f, pos: new Set(mine.map(a => a.recruitBadge.toLowerCase())).size, phases: [...new Set(mine.map(a => `${a.className} · Phase ${a.phase}`))] };
      });
  }, [ws.ftoDirectory, ws.assignments, query]);
  if (ws.role !== 'fto_coordinator') return <Redirect to="/" />;

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="Coordinator" title="FTO Directory" photo="class-seated" stats={[
      { label: 'FTO’s', value: ws.ftoDirectory.length, testId: 'hero-fto-count' },
      { label: 'PO’s Trained', value: new Set(ws.assignments.map(a => a.recruitBadge.toLowerCase())).size, testId: 'hero-pos-trained' },
      { label: 'Phases Covered', value: new Set(ws.assignments.map(a => `${a.className}|${a.phase}`)).size, testId: 'hero-phases-covered' },
    ]} />
    <Panel title={`${ws.ftoDirectory.length} FTO’s`} action={<input type="search" aria-label="Search FTO directory" placeholder="Name, badge or email" value={query} onChange={e => setQuery(e.target.value)} className="h-9 w-full rounded border bg-card px-3 text-sm sm:w-64" data-testid="input-fto-directory-search" />}>
      <div className="overflow-x-auto">
        <table className="portal-table" data-testid="table-fto-directory">
          <thead><tr><th>FTO</th><th>Badge</th><th>Email</th><th>{caseSafe('PO’s')}</th><th>Assignments</th></tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={5} className="portal-table-empty">None</td></tr>
              : rows.map(f => <tr key={f.badge} data-testid={`row-fto-${f.badge}`}>
                <td><b>{f.name}</b></td>
                <td className="mono">{f.badge}</td>
                <td className="break-all">{f.email ?? '—'}</td>
                <td className="mono">{f.pos}</td>
                <td>{f.phases.length ? f.phases.join(', ') : '—'}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  </div>;
}
