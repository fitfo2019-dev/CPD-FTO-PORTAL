import { lazy, Suspense, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { formatDateDMY, localISODate } from '@/lib/training-calendar.js';
import { PageHead, Panel } from '@/components/bits.js';
import { CountTile } from '@/pages/dashboard.js';
import { IncentiveReportPanel } from '@/components/incentive-report-panel.js';
import { AlertPanelStatus, CloseAlertDialog, useAlertActor } from '@/components/close-alert-dialog.js';
import { useTrainingAlerts } from '@/state/training-alerts.js';
import { formatStamp, type AlertView } from '@/lib/training-alerts.js';
import { useToast } from '@/hooks/use-toast.js';

// PO Progress uses the rebuild sample data and stays development-only until the server roster is live.
const PoProgressCards = import.meta.env.DEV
  ? lazy(() => import('@/features/rebuild/pages.js').then(m => ({ default: m.RebuildPoProgressCards })))
  : null;

const TAG: Record<AlertView['kind'], string> = { NRT: 'NRT', NRT_REVIEW_REQUEST: 'NRT review request', NOT_RELEASE: 'Non-Release', FTO_WITHDRAWAL: 'FTO Withdrawal' };
const HREF = '/reports/weekly-packet';
const label = (a: AlertView) => `${TAG[a.kind]} · ${a.who}${a.detail ? ` · ${a.detail}` : ''}`;

export default function SergeantHome() {
  const { ws } = useWorkspace();
  const { toast } = useToast();
  const actor = useAlertActor(ws.role);
  const [closing, setClosing] = useState<AlertView | null>(null);
  // FTO Withdrawal alerts come from Phase Sign-Up, which is not yet on the agency server.
  const { source, alerts: all, close } = useTrainingAlerts({ includeWithdrawals: true });
  const alerts = all.filter(a => !a.closure);
  const closed = all.filter(a => a.closure);
  const count = (kinds: AlertView['kind'][]) => alerts.filter(a => kinds.includes(a.kind)).length;
  const nrtOpen = count(['NRT', 'NRT_REVIEW_REQUEST']), nonReleaseOpen = count(['NOT_RELEASE']), withdrawalsOpen = count(['FTO_WITHDRAWAL']);

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="FTO Sergeant" title="Sergeant Dashboard" photo="officers-portrait">
      <span className="mono text-xs text-muted-foreground">{formatDateDMY(localISODate())}</span>
    </PageHead>

    <div className="count-tiles" data-testid="sergeant-count-tiles">
      <CountTile label="Open NRT" value={nrtOpen} alert={nrtOpen > 0} testId="stat-open-nrt" />
      <CountTile label="Non-Release" value={nonReleaseOpen} alert={nonReleaseOpen > 0} testId="stat-non-release" />
      <CountTile label="FTO Withdrawals" value={withdrawalsOpen} alert={withdrawalsOpen > 0} testId="stat-withdrawals" />
    </div>

    <Panel title="Alerts" className="mb-4" action={<AlertPanelStatus source={source} open={alerts.length} />}>
      {alerts.length === 0
        ? <p className="p-4 text-sm text-muted-foreground">None</p>
        : <ul className="divide-y text-sm" data-testid="list-sergeant-alerts">{alerts.map(a => <li key={a.key} className="flex items-center gap-2 pr-3">
          <Link href={HREF} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-muted/60">
            <span className="portal-tag is-alert">{TAG[a.kind]}</span>
            {a.changedToRelease && <span className="portal-tag" data-testid={`tag-changed-release-${a.key}`}>Changed to Release</span>}
            <span className="min-w-0 flex-1 break-words">{a.who}{a.detail ? ` · ${a.detail}` : ''}</span>
            <span className="mono hidden text-xs text-muted-foreground sm:block">{formatStamp(a.at)}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <button type="button" className="shrink-0 rounded-sm border bg-card px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
            onClick={() => setClosing(a)} data-testid={`button-close-alert-${a.key}`}>Close alert</button>
        </li>)}</ul>}
      {closed.length > 0 && <details className="border-t text-sm" data-testid="list-sergeant-closed-alerts">
        <summary className="label-caps cursor-pointer px-4 py-3">Closed · {closed.length}</summary>
        <ul className="divide-y">{closed.map(a => <li key={a.key} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2"><span className="portal-tag">{TAG[a.kind]}</span>{a.changedToRelease && <span className="portal-tag">Changed to Release</span>}<span className="break-words">{a.who}{a.detail ? ` · ${a.detail}` : ''}</span></div>
          <p className="mt-1 whitespace-pre-wrap break-words">{a.closure!.note}</p>
          <p className="mono mt-1 text-xs text-muted-foreground">{a.closure!.line}</p>
        </li>)}</ul>
      </details>}
    </Panel>

    <CloseAlertDialog open={closing !== null} alertLabel={closing ? label(closing) : ''}
      onOpenChange={open => { if (!open) setClosing(null); }}
      onClose={note => {
        const target = closing; setClosing(null);
        if (target) void close(target, note, actor).then(
          () => toast({ title: target.serverId ? 'Alert closed for all recipients' : 'Alert closed on this device' }),
          () => toast({ title: 'Alert not closed', description: 'The agency server did not save the closing note.', variant: 'destructive' }));
      }} />

    <IncentiveReportPanel reports={ws.reports} folders={ws.phaseFolders} />

    {PoProgressCards && <section aria-label="PO Progress" data-testid="section-sergeant-po-progress">
      <h2 className="label-caps mb-2 text-foreground">PO Progress</h2>
      <Suspense fallback={<div role="status" className="p-4 text-sm">Loading…</div>}><PoProgressCards /></Suspense>
    </section>}
  </div>;
}
