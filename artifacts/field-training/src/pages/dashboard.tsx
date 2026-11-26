import { Link } from 'wouter';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardList, FolderOpen } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { CATEGORIES, CATEGORY_LABEL, evaluationProgress, needsJustification, phaseAssignmentLabel, type Workspace } from '@/lib/model.js';
import { formatDateDMY, getPhaseEndDate, localISODate } from '@/lib/training-calendar.js';
import { PageHead, Panel, RatingChip, StatusPill, caseSafe } from '@/components/bits.js';
import { NrtAdminReviewPanel } from '@/components/nrt-admin-review-panel.js';
import { PhaseExtensionPanel } from '@/components/phase-extension-panel.js';
import { missingDailySummaryDates } from '@/lib/weekly-packet.js';
import { cn } from '@/lib/utils.js';

export default function Dashboard() {
  const { ws } = useWorkspace();
  if (ws.role === 'fto_coordinator') return <CoordinatorDashboard />;
  return <FtoDailyPacketHome />;
}

/* ---------- Shared pieces ---------- */

export function CountTile({ label, value, alert, href, testId }: { label: string; value: ReactNode; alert?: boolean; href?: string; testId: string }) {
  const body = <>
    <span className="count-tile-label">{caseSafe(label)}</span>
    <b className="count-tile-value">{value}</b>
  </>;
  const cls = cn('count-tile', alert && 'is-alert', href && 'is-link');
  return href
    ? <Link href={href} className={cls} data-testid={testId}>{body}</Link>
    : <div className={cls} data-testid={testId}>{body}</div>;
}

function todayLabel() {
  return <span className="mono text-xs text-muted-foreground" data-testid="text-today">{formatDateDMY(localISODate())}</span>;
}

/** One FTO may hold only one PO per class phase; extra pairings are conflicts. */
export function assignmentConflicts(ws: Workspace) {
  const seen = new Map<string, number>();
  for (const a of ws.assignments) {
    const key = `${a.className}|${a.phase}|${a.ftoBadge.toLowerCase()}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return ws.assignments.filter(a => (seen.get(`${a.className}|${a.phase}|${a.ftoBadge.toLowerCase()}`) ?? 0) > 1);
}

export function ratingFlags(ws: Workspace) {
  return ws.reports.flatMap(report => CATEGORIES.filter(category => {
    const rating = report.ratings[category].rating;
    return rating === 'UA' || rating === 'NRT';
  }).map(category => ({ report, category })));
}

/** Preview count from the PO Progress sample; loads only in development builds, like the PO Progress route. */
function useBelowStandardCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let live = true;
    void import('@/features/rebuild/lib/po-progress/data').then(m => {
      if (live) setCount(m.PROGRESS.pos.filter(p => m.inSampleGroup(p) && p.status === 'BELOW STANDARD').length);
    });
    return () => { live = false; };
  }, []);
  return count;
}

/* ---------- Coordinator Dashboard ---------- */

function CoordinatorDashboard() {
  const { ws } = useWorkspace();
  const today = localISODate();
  const belowStandard = useBelowStandardCount();
  const poCount = new Set(ws.assignments.map(a => a.recruitBadge.toLowerCase())).size;
  const awaiting = ws.weeklyAcknowledgements.filter(item => item.status !== 'office_signed');
  const withdrawn = ws.ftoPhaseSignups.filter(item => item.status === 'withdrawn');
  const conflicts = assignmentConflicts(ws);
  const flags = ratingFlags(ws);

  const classes = useMemo(() => {
    const byClass = new Map<string, typeof ws.assignments>();
    for (const a of ws.assignments) byClass.set(a.className, [...(byClass.get(a.className) ?? []), a]);
    return [...byClass.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([className, rows]) => {
      const pos = new Set(rows.map(r => r.recruitBadge.toLowerCase())).size;
      const started = rows.filter(r => r.phaseStartDate && r.phaseStartDate <= today);
      const current = started.reduce<typeof rows[number] | undefined>((best, r) => !best || r.phase > best.phase ? r : best, undefined);
      const first = rows.reduce<string | undefined>((min, r) => r.phaseStartDate && (!min || r.phaseStartDate < min) ? r.phaseStartDate : min, undefined);
      const finalPhase = rows.find(r => r.phase === 4 && r.phaseStartDate);
      const completion = finalPhase ? getPhaseEndDate(4, finalPhase.phaseStartDate) : undefined;
      const currentEnd = current ? getPhaseEndDate(current.phase, current.phaseStartDate) : undefined;
      const active = !!current && !!currentEnd && today <= currentEnd;
      return { className, pos, first, current, currentEnd, completion, active };
    });
  }, [ws.assignments, today]);

  const attention = [
    ...conflicts.map(a => ({ key: `c-${a.id}`, tag: 'Conflict', text: `${a.className} · Phase ${a.phase} · FTO #${a.ftoBadge} · PO ${a.recruitName} #${a.recruitBadge}`, href: '/phase-setup' })),
    ...withdrawn.map(s => ({ key: `w-${s.id}`, tag: 'Withdrawn', text: `FTO ${s.ftoName} #${s.ftoBadge}`, href: '/fto-classes' })),
    ...awaiting.map(a => ({ key: `p-${a.id}`, tag: 'Packet', text: `${a.recruitName || 'Weekly packet'}`, href: '/reports/weekly-ack' })),
  ];

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="Coordinator" title="Coordinator Dashboard">{todayLabel()}</PageHead>

    <div className="count-tiles" data-testid="coordinator-count-tiles">
      {import.meta.env.DEV && <CountTile label="PO’s Below Standard" value={belowStandard ?? '–'} alert={!!belowStandard} href="/po-progress?show=below-standard" testId="stat-po-review" />}
      <CountTile label="PO’s in Field Training" value={poCount} testId="stat-pos-in-training" />
      <CountTile label="Packets Awaiting Review" value={awaiting.length} alert={awaiting.length > 0} href="/reports/weekly-ack" testId="stat-packets-awaiting" />
      <CountTile label="Withdrawn" value={withdrawn.length} alert={withdrawn.length > 0} href="/fto-classes" testId="stat-withdrawn" />
      <CountTile label="Conflicts" value={conflicts.length} alert={conflicts.length > 0} href="/phase-setup" testId="stat-conflicts" />
    </div>

    <Panel title="Classes" className="mb-4">
      <div className="overflow-x-auto">
        <table className="portal-table" data-testid="table-classes">
          <thead><tr><th>Class</th><th>{caseSafe('PO’s')}</th><th>Start</th><th>Current Phase</th><th>Projected Completion</th><th>Status</th><th /></tr></thead>
          <tbody>
            {classes.length === 0
              ? <tr><td colSpan={7} className="portal-table-empty">No classes</td></tr>
              : classes.map(c => <tr key={c.className} data-testid={`row-class-${c.className}`}>
                <td><b>{c.className}</b></td>
                <td className="mono">{c.pos}</td>
                <td className="mono">{c.first ? formatDateDMY(c.first) : '—'}</td>
                <td>{c.current ? `Phase ${c.current.phase} · ${formatDateDMY(c.current.phaseStartDate)}${c.currentEnd ? ` – ${formatDateDMY(c.currentEnd)}` : ''}` : '—'}</td>
                <td className="mono">{c.completion ? formatDateDMY(c.completion) : '—'}</td>
                <td><span className={cn('portal-tag', c.active && 'is-ok')}>{c.active ? `Phase ${c.current!.phase} Active` : c.current ? 'Between Phases' : 'Not Started'}</span></td>
                <td className="text-right"><Link href="/class-overview" className="portal-ghost-button">Open</Link></td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </Panel>

    <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="Needs Attention" action={attention.length ? <span className="portal-tag is-alert">{attention.length}</span> : undefined}>
        {attention.length === 0
          ? <p className="p-4 text-sm text-muted-foreground">None</p>
          : <ul className="divide-y text-sm" data-testid="list-needs-attention">{attention.map(item => <li key={item.key}>
            <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
              <span className="portal-tag is-alert">{item.tag}</span><span className="min-w-0 flex-1 break-words">{item.text}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>)}</ul>}
      </Panel>
      <div className="space-y-4">
        <RatingFlagsPanel flags={flags} />
        <NrtAdminReviewPanel />
      </div>
    </div>

    <div className="mt-4"><PhaseExtensionPanel /></div>
  </div>;
}

function RatingFlagsPanel({ flags }: { flags: ReturnType<typeof ratingFlags> }) {
  return <Panel title="Unacceptable / NRT Follow-Up">
    {flags.length === 0
      ? <p className="p-4 text-sm text-muted-foreground">None</p>
      : <ul className="divide-y text-sm">{flags.map(({ report, category }) => <li key={report.id + category} className="flex items-start gap-3 px-4 py-3">
        <RatingChip r={report.ratings[category].rating} />
        <div className="min-w-0"><b className="block">{CATEGORY_LABEL[category]}</b><Link href={`/reports/${report.id}`} className="underline">{report.recruitName} · {formatDateDMY(report.date)}</Link>{needsJustification(report.ratings[category].rating) && <p className="mt-1 line-clamp-2 text-muted-foreground">{report.ratings[category].justification || 'Justification missing'}</p>}</div>
      </li>)}</ul>}
  </Panel>;
}

/* ---------- FTO Daily Packet home ---------- */

function FtoDailyPacketHome() {
  const { ws } = useWorkspace();
  const reports = ws.reports;
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  const folder = ws.caseFolder;
  const currentDraft = folder && sorted.find(report => report.status === 'draft' && report.recruitBadge === folder.recruitBadge && report.phase === folder.phase);
  const todayReport = folder && sorted.find(report => report.date === localISODate() && report.recruitBadge === folder.recruitBadge && report.phase === folder.phase);
  const shiftHref = folder ? (currentDraft ? `/reports/${currentDraft.id}` : '/reports/new') : '/phase-setup';
  const shiftLabel = folder ? (currentDraft ? 'Continue Shift' : todayReport ? 'Start Next Shift' : 'Start Shift') : 'Set Up Phase Folder';
  const weeklyOpen = ws.weeklyAcknowledgements.filter(item => item.status !== 'office_signed').length;
  const finalized = reports.filter(report => report.status === 'locked').length;
  const evaluationsComplete = reports.filter(report => evaluationProgress(report) === 'Complete').length;
  const missing = folder && ws.role === 'fto' ? missingDailySummaryDates(folder, reports, localISODate()) : [];
  const flags = ratingFlags(ws);

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="FTO" title="Daily Packet">
      <Link href={shiftHref} data-testid={folder ? 'link-start-shift' : 'link-phase-setup'} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground">
        {folder ? <ClipboardList className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}{shiftLabel}
      </Link>
    </PageHead>

    <PhaseExtensionPanel />

    {missing.length > 0 && <section aria-label="Missing Daily Performance Summaries" data-testid="card-missing-daily-summary" className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/30">
      <p className="label-caps text-amber-800 dark:text-amber-300">{caseSafe('Missing Daily Performance Summaries')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {missing.map(date => <li key={date}><Link href={`/reports/new?date=${date}`} data-testid={`link-missing-daily-summary-${date}`} className="inline-flex min-h-10 items-center rounded border bg-card px-3 text-sm font-semibold">{formatDateDMY(date)}</Link></li>)}
      </ul>
    </section>}

    <div className="count-tiles" data-testid="fto-count-tiles">
      <CountTile label="Daily Records" value={reports.length} href="/reports" testId="stat-daily-records" />
      <CountTile label="Finalized" value={finalized} testId="stat-finalized" />
      <CountTile label="Evaluations Complete" value={evaluationsComplete} testId="stat-evaluations" />
      <CountTile label="Weekly Packets Open" value={weeklyOpen} alert={weeklyOpen > 0} href="/reports/weekly-packet" testId="stat-weekly-open" />
      <CountTile label="UA / NRT Ratings" value={flags.length} alert={flags.length > 0} testId="stat-flags" />
    </div>

    {folder && <Panel title="Current Phase Folder" action={<Link href="/phase-setup" className="portal-ghost-button">Edit Setup</Link>} className="mb-4">
      <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="panel-current-folder">
        <div><span className="label-caps">Probationary Officer</span><b className="mt-1 block break-words">{folder.recruitName} · #{folder.recruitBadge}</b></div>
        <div><span className="label-caps">Class and Phase</span><b className="mt-1 block break-words">{folder.className} · Phase {folder.phase}</b></div>
        <div><span className="label-caps">Assigned FTO</span><b className="mt-1 block break-words">{folder.ftoName} · #{folder.ftoBadge}</b></div>
        <div><span className="label-caps">FTO Assignment</span><b className="mt-1 block break-words">{phaseAssignmentLabel(folder.ftoAssignment, folder.shift, folder.cruiserDistrict)}</b></div>
      </div>
    </Panel>}

    <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Panel title="Recent Shift Records" action={<Link href="/reports" className="portal-ghost-button" data-testid="link-all-reports">Daily Records</Link>}>
        {sorted.length === 0 ? <p className="p-4 text-sm text-muted-foreground">None</p> :
          <ul className="divide-y">{sorted.slice(0, 6).map(report => <li key={report.id}><Link href={`/reports/${report.id}`} data-testid={`row-recent-${report.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
            <div className="min-w-0 flex-1 text-sm"><b className="block truncate">{report.recruitName} · #{report.recruitBadge}</b><span className="text-xs text-muted-foreground">{formatDateDMY(report.date)} · {phaseAssignmentLabel(report.ftoAssignment, report.shift, report.cruiserDistrict)}</span></div>
            <span className="hidden text-xs text-muted-foreground md:block">{evaluationProgress(report)}</span><StatusPill s={report.status} /><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link></li>)}</ul>}
      </Panel>
      <div className="space-y-4">
        <RatingFlagsPanel flags={flags} />
        <NrtAdminReviewPanel />
      </div>
    </div>
  </div>;
}
