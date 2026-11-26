import { Link } from 'wouter';
import { ClipboardList } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/model.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { nrtReference } from '@/lib/nrt-reference.js';
import { useWorkspace } from '@/state/workspace.js';

export default function NrtUaPortalPage() {
  const { ws } = useWorkspace();
  const reviewedUas = ws.reports
    .flatMap(report => CATEGORIES.flatMap(category => {
      const entry = report.ratings?.[category];
      return entry?.rating === 'UA' && report.ratingsReviewedAt
        ? [{ report, category, entry }]
        : [];
    }))
    .sort((a,b) => b.report.date.localeCompare(a.report.date));
  const nrtEntries = ws.reports
    .flatMap(report => CATEGORIES.flatMap(category => {
      const entry = report.ratings?.[category];
      return entry?.rating === 'NRT' ? [{ report, category, entry }] : [];
    }))
    .sort((a,b) => b.report.date.localeCompare(a.report.date));

  if (ws.role !== 'fto' && ws.role !== 'fto_coordinator') {
    return <Panel title="NRT / UA Portal unavailable"><p className="p-4 text-sm">This review workspace is limited to FTO’s and the FTO Coordinator.</p></Panel>;
  }

  return <div className="mx-auto w-full max-w-5xl">
    <PageHead kicker="Training review support" title="NRT / UA Portal">
      <span className="rounded border bg-card px-3 py-2 text-sm font-bold">{reviewedUas.length} reviewed UA</span>
    </PageHead>

    <Panel title={`Reviewed Unacceptable ratings · ${reviewedUas.length}`}>
      {reviewedUas.length === 0
        ? <p className="p-4 text-sm text-muted-foreground">No reviewed UA ratings are available.</p>
        : <div className="divide-y">{reviewedUas.map(({report,category,entry})=><article key={`${report.id}-${category}`} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">UA</span>
              <b className="mono text-sm">{nrtReference(report,ws.assignments,ws.caseFolder)}</b>
              <span className="text-sm font-semibold">{CATEGORY_LABEL[category]}</span>
            </div>
            <p className="mt-1 text-sm">PO {report.recruitName} #{report.recruitBadge} · {formatDateDMY(report.date)} · Phase {report.phase} · FTO {report.ftoName}</p>
            {entry.justification && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.justification}</p>}
          </div>
          <Link href={`/reports/${report.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border bg-card px-3 text-sm font-semibold hover:bg-muted">
            <ClipboardList className="h-4 w-4" />Open daily summary
          </Link>
        </article>)}</div>}
    </Panel>

    <Panel title={`NRT ratings · ${nrtEntries.length}`} className="mt-4">
      {nrtEntries.length === 0
        ? <p className="p-4 text-sm text-muted-foreground">No NRT ratings are active.</p>
        : <div className="divide-y">{nrtEntries.map(({report,category,entry})=>{
          const linked=entry.nrtPriorUnacceptableIds??[];
          const status=entry.nrtOfficeReviewStatus==='responded'?'Response saved locally':entry.nrtOfficeReviewStatus==='submitted'?'Submitted for local review':'Follow-up needed';
          return <article key={`${report.id}-${category}`} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">NRT</span>
                <b className="mono text-sm">{nrtReference(report,ws.assignments,ws.caseFolder)}</b>
                <span className="text-sm font-semibold">{CATEGORY_LABEL[category]}</span>
              </div>
              <p className="mt-1 text-sm">PO {report.recruitName} #{report.recruitBadge} · {formatDateDMY(report.date)} · {status} · {linked.length} linked UA</p>
              {entry.justification && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.justification}</p>}
            </div>
            <Link href={`/reports/${report.id}/nrt-follow-up?category=${encodeURIComponent(category)}`} className="inline-flex min-h-10 items-center justify-center rounded border bg-card px-3 text-sm font-semibold hover:bg-muted">
              Open NRT follow-up
            </Link>
          </article>;
        })}</div>}
    </Panel>
  </div>;
}
