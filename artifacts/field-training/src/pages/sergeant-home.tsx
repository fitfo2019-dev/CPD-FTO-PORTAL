import { lazy, Suspense, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { formatDateDMY, localISODate } from '@/lib/training-calendar.js';
import { PageHead, Panel } from '@/components/bits.js';
import { CountTile } from '@/pages/dashboard.js';
import { IncentiveReportPanel } from '@/components/incentive-report-panel.js';
import { CloseAlertDialog, closureLine, useAlertActor } from '@/components/close-alert-dialog.js';

// PO Progress uses the rebuild sample data and stays development-only until the server roster is live.
const PoProgressCards = import.meta.env.DEV
  ? lazy(() => import('@/features/rebuild/pages.js').then(m => ({ default: m.RebuildPoProgressCards })))
  : null;

type Alert = { key: string; tag: 'NRT' | 'Non-Release' | 'FTO Withdrawal'; text: string; at: string; href: string };

export default function SergeantHome() {
  const { ws, closeAlert } = useWorkspace();
  const actor = useAlertActor(ws.role);
  const [closing, setClosing] = useState<Alert | null>(null);
  const nrt: Alert[] = ws.nrtReviewRequests.map(r => ({
    key: `nrt-${r.id}`, tag: 'NRT', at: r.createdAt,
    text: `PO ${r.recruitName} #${r.recruitBadge} · ${r.className} · Phase ${r.phase}`,
    href: '/reports/weekly-packet',
  }));
  const nonRelease: Alert[] = ws.week15Recommendations.filter(r => r.choice === 'not_release').map(r => ({
    key: `nr-${r.id}`, tag: 'Non-Release', at: r.updatedAt,
    text: `PO ${r.recruitName} #${r.recruitBadge} · ${r.className}`,
    href: '/reports/weekly-packet',
  }));
  const withdrawals: Alert[] = ws.ftoPhaseSignups.filter(s => s.status === 'withdrawn').map(s => ({
    key: `wd-${s.id}`, tag: 'FTO Withdrawal', at: s.updatedAt,
    text: `FTO ${s.ftoName} #${s.ftoBadge}`,
    href: '/reports/weekly-packet',
  }));
  const closures = new Map((ws.alertClosures ?? []).map(c => [c.alertKey, c]));
  const isOpen = (a: Alert) => !closures.has(a.key);
  const all = [...nrt, ...nonRelease, ...withdrawals].sort((a, b) => b.at.localeCompare(a.at));
  const alerts = all.filter(isOpen);
  const closed = all.filter(a => !isOpen(a));

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="FTO Sergeant" title="Sergeant Dashboard">
      <span className="mono text-xs text-muted-foreground">{formatDateDMY(localISODate())}</span>
    </PageHead>

    <div className="count-tiles" data-testid="sergeant-count-tiles">
      <CountTile label="Open NRT" value={nrt.filter(isOpen).length} alert={nrt.some(isOpen)} testId="stat-open-nrt" />
      <CountTile label="Non-Release" value={nonRelease.filter(isOpen).length} alert={nonRelease.some(isOpen)} testId="stat-non-release" />
      <CountTile label="FTO Withdrawals" value={withdrawals.filter(isOpen).length} alert={withdrawals.some(isOpen)} testId="stat-withdrawals" />
    </div>

    <Panel title="Alerts" className="mb-4" action={alerts.length ? <span className="portal-tag is-alert">{alerts.length}</span> : undefined}>
      {alerts.length === 0
        ? <p className="p-4 text-sm text-muted-foreground">None</p>
        : <ul className="divide-y text-sm" data-testid="list-sergeant-alerts">{alerts.map(a => <li key={a.key} className="flex items-center gap-2 pr-3">
          <Link href={a.href} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-muted/60">
            <span className="portal-tag is-alert">{a.tag}</span>
            <span className="min-w-0 flex-1 break-words">{a.text}</span>
            <span className="mono hidden text-xs text-muted-foreground sm:block">{formatDateDMY(a.at.slice(0, 10))}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <button type="button" className="shrink-0 rounded-sm border bg-card px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            onClick={() => setClosing(a)} data-testid={`button-close-alert-${a.key}`}>Close alert</button>
        </li>)}</ul>}
      {closed.length > 0 && <details className="border-t text-sm" data-testid="list-sergeant-closed-alerts">
        <summary className="label-caps cursor-pointer px-4 py-3">Closed · {closed.length}</summary>
        <ul className="divide-y">{closed.map(a => { const c = closures.get(a.key)!; return <li key={a.key} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2"><span className="portal-tag">{a.tag}</span><span className="break-words">{a.text}</span></div>
          <p className="mt-1 whitespace-pre-wrap break-words">{c.note}</p>
          <p className="mono mt-1 text-xs text-muted-foreground">{closureLine(c)}</p>
        </li>; })}</ul>
      </details>}
    </Panel>

    <CloseAlertDialog open={closing !== null} alertLabel={closing ? `${closing.tag} · ${closing.text}` : ''}
      onOpenChange={open => { if (!open) setClosing(null); }}
      onClose={note => { if (closing) closeAlert({ alertKey: closing.key, note, closedBy: actor, closedAt: new Date().toISOString() }); setClosing(null); }} />

    <IncentiveReportPanel reports={ws.reports} folders={ws.phaseFolders} />

    {PoProgressCards && <section aria-label="PO Progress" data-testid="section-sergeant-po-progress">
      <h2 className="label-caps mb-2 text-foreground">PO Progress</h2>
      <Suspense fallback={<div role="status" className="p-4 text-sm">Loading…</div>}><PoProgressCards /></Suspense>
    </section>}
  </div>;
}
