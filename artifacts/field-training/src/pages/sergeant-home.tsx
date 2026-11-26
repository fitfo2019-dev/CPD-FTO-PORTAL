import { lazy, Suspense } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { formatDateDMY, localISODate } from '@/lib/training-calendar.js';
import { PageHead, Panel } from '@/components/bits.js';
import { CountTile } from '@/pages/dashboard.js';

// PO Progress uses the rebuild sample data and stays development-only until the server roster is live.
const PoProgressCards = import.meta.env.DEV
  ? lazy(() => import('@/features/rebuild/pages.js').then(m => ({ default: m.RebuildPoProgressCards })))
  : null;

type Alert = { key: string; tag: 'NRT' | 'Non-Release' | 'FTO Withdrawal'; text: string; at: string; href: string };

export default function SergeantHome() {
  const { ws } = useWorkspace();
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
  const alerts = [...nrt, ...nonRelease, ...withdrawals].sort((a, b) => b.at.localeCompare(a.at));

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="FTO Sergeant" title="Sergeant Dashboard" photo="officers-portrait">
      <span className="mono text-xs text-muted-foreground">{formatDateDMY(localISODate())}</span>
    </PageHead>

    <div className="count-tiles" data-testid="sergeant-count-tiles">
      <CountTile label="Open NRT" value={nrt.length} alert={nrt.length > 0} testId="stat-open-nrt" />
      <CountTile label="Non-Release" value={nonRelease.length} alert={nonRelease.length > 0} testId="stat-non-release" />
      <CountTile label="FTO Withdrawals" value={withdrawals.length} alert={withdrawals.length > 0} testId="stat-withdrawals" />
    </div>

    <Panel title="Alerts" className="mb-4" action={alerts.length ? <span className="portal-tag is-alert">{alerts.length}</span> : undefined}>
      {alerts.length === 0
        ? <p className="p-4 text-sm text-muted-foreground">None</p>
        : <ul className="divide-y text-sm" data-testid="list-sergeant-alerts">{alerts.map(a => <li key={a.key}>
          <Link href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
            <span className="portal-tag is-alert">{a.tag}</span>
            <span className="min-w-0 flex-1 break-words">{a.text}</span>
            <span className="mono hidden text-xs text-muted-foreground sm:block">{formatDateDMY(a.at.slice(0, 10))}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>)}</ul>}
    </Panel>

    {PoProgressCards && <section aria-label="PO Progress" data-testid="section-sergeant-po-progress">
      <h2 className="label-caps mb-2 text-foreground">PO Progress</h2>
      <Suspense fallback={<div role="status" className="p-4 text-sm">Loading…</div>}><PoProgressCards /></Suspense>
    </section>}
  </div>;
}
