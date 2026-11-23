import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Download, Printer } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { PrintableMonthlySummary } from '@/components/printable-monthly-summary.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { DAILY_ACTIVITY_COLUMNS, DAILY_ACTIVITY_FIELDS, RATINGS, SEG_CATEGORIES, SEG_RATING_COLUMNS, SEG_RATING_GROUP_LABELS } from '@/lib/model.js';
import { useMonthlyExcelAggregator } from '@/hooks/use-monthly-excel-aggregator.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { useWorkspace } from '@/state/workspace.js';
import { filterReportsForMonth } from '@/lib/monthly-summary.js';

const ownerKey = (report: { className?: string; recruitBadge: string; recruitName: string }) =>
  JSON.stringify([report.className ?? '', report.recruitBadge, report.recruitName]);

const ratingTone: Record<(typeof RATINGS)[number], string> = {
  NO: 'monthly-rating-no',
  A: 'monthly-rating-a',
  RT: 'monthly-rating-rt',
  UA: 'monthly-rating-ua',
  NRT: 'monthly-rating-nrt',
};

function formatMonth(monthKey: string) {
  const date = new Date(`${monthKey}-15T12:00:00`);
  return Number.isNaN(date.getTime())
    ? monthKey
    : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export default function MonthlySummaryPage() {
  const { ws } = useWorkspace();
  useEffect(() => {
    document.body.classList.add('print-monthly-route');
    return () => document.body.classList.remove('print-monthly-route');
  }, []);
  const owners = useMemo(() => [...new Map(
    [...ws.reports, ...(ws.caseFolder ? [ws.caseFolder] : [])].map(report => [
      ownerKey(report),
      { key: ownerKey(report), name: report.recruitName, badge: report.recruitBadge, className: report.className ?? '' },
    ]),
  ).values()].sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name)), [ws.reports, ws.caseFolder]);
  const [selectedOwner, setSelectedOwner] = useState(() => ws.caseFolder ? ownerKey(ws.caseFolder) : owners[0]?.key ?? '');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const owner = owners.find(person => person.key === selectedOwner) ?? owners[0];
  const ownerReports = owner ? ws.reports.filter(report => ownerKey(report) === owner.key) : [];
  const months = useMemo(() => [...new Set(ownerReports.map(report => report.date.slice(0, 7)))]
    .filter(month => /^\d{4}-\d{2}$/.test(month)).sort((a, b) => b.localeCompare(a)), [ownerReports]);
  const monthKey = months.includes(selectedMonth) ? selectedMonth : months[0] ?? '';
  const monthReports=filterReportsForMonth(ownerReports,monthKey);
  const monthPhases=[...new Set(monthReports.map(report=>report.phase))];
  const phaseFolder=monthPhases.length===1
    ?ws.phaseFolders.find(folder=>ownerKey(folder)===owner?.key&&folder.phase===monthPhases[0])
      ??(ws.caseFolder&&ownerKey(ws.caseFolder)===owner?.key&&ws.caseFolder.phase===monthPhases[0]?ws.caseFolder:undefined)
    :undefined;
  const { reports, summary, workbookWeekRanges } = useMonthlyExcelAggregator(ownerReports, monthKey,phaseFolder?.phaseWeekRanges);
  const monthLabel = monthKey ? formatMonth(monthKey) : 'No monthly records';
  const rangeStart = reports[0]?.date ?? '';
  const rangeEnd = reports[reports.length - 1]?.date ?? '';

  const exportWorkbook = async () => {
    if (!reports.length || !monthKey || exporting) return;
    setExporting(true);
    setExportMessage('');
    try {
      const { exportMonthlyWorkbook } = await import('@/lib/monthly-export.js');
      exportMonthlyWorkbook(reports, monthKey,workbookWeekRanges);
      setExportMessage('Monthly Excel workbook downloaded.');
    } catch (error) {
      setExportMessage(error instanceof Error&&error.name==='MonthlyWorkbookRangeError'
        ?error.message
        :'The workbook could not be created. Your saved daily records are unchanged.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="monthly-summary-page min-w-0 max-w-6xl">
      <PageHead kicker="Monthly Performance Summary" title={monthLabel}>
        <Link href="/reports" className="inline-flex h-10 items-center rounded-sm border bg-card px-4 text-sm font-bold">Daily Records</Link>
        <button type="button" disabled={!reports.length} onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-sm border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid="button-print-monthly">
          <Printer className="h-4 w-4" />Print / PDF
        </button>
        <button type="button" disabled={!reports.length || exporting} onClick={exportWorkbook} className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-export-monthly">
          <Download className="h-4 w-4" />{exporting ? 'Creating workbook…' : 'Export Excel'}
        </button>
      </PageHead>

      <div className="mb-4 flex flex-col items-start gap-3 rounded-sm border bg-card p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
        {owners.length > 1 && <label className="flex w-full min-w-0 flex-col gap-1 font-semibold sm:w-auto">
          Probationary Officer
          <SearchableSelect aria-label="Select Probationary Officer" className="h-10 min-w-0 max-w-full rounded-sm border bg-card px-3 text-sm" value={owner?.key ?? ''} onChange={event => { setSelectedOwner(event.target.value); setSelectedMonth(''); }} data-testid="select-monthly-officer">
            {owners.map(person => <option key={person.key} value={person.key}>{person.name} · {person.badge} · {person.className || 'Class not assigned'}</option>)}
          </SearchableSelect>
        </label>}
        {months.length > 1 && <label className="flex w-full min-w-0 flex-col gap-1 font-semibold sm:w-auto">
          Select month
          <SearchableSelect className="h-10 min-w-0 max-w-full rounded-sm border bg-card px-3 text-sm" value={monthKey} onChange={event => setSelectedMonth(event.target.value)} data-testid="select-monthly-month">
            {months.map(month => <option key={month} value={month}>{formatMonth(month)}</option>)}
          </SearchableSelect>
        </label>}
        <span className="min-w-0 break-words text-muted-foreground">
          {reports.length
            ? `${formatDateDMY(rangeStart)}–${formatDateDMY(rangeEnd)} · ${reports.length} saved daily logs · ${summary.reviewedLogCount} reviewed for ratings`
            : 'No daily records are saved for this Probationary Officer yet.'}
        </span>
      </div>

      <div role="note" className="mb-4 rounded-sm border bg-muted/60 p-3 text-sm">
        Monthly rating counts include reviewed daily summaries only; unreviewed default ratings are excluded. Activity totals combine manual entries with versioned clearance-derived counts from new reviewed runs. Run activity checkboxes remain supporting evidence. This monthly view does not change daily logs and includes local records only. Excel exports use four separate weekly tabs and stop when the source month requires more than four ranges; weeks are never combined.
      </div>
      {exportMessage && <p role="status" className="mb-4 rounded-sm border bg-card p-3 text-sm">{exportMessage}</p>}

      {!reports.length ? (
        <Panel><p className="p-6 text-center text-sm text-muted-foreground">Create and save a daily performance log to build this month’s summary.</p></Panel>
      ) : <>
        <Panel title="Monthly rating counts by SEG category" className="mb-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-b px-4 py-3 text-sm">
            {RATINGS.map(rating => <span key={rating} className={`inline-flex items-center gap-2 rounded-sm px-2 py-1 ${ratingTone[rating]}`}><b className="mono">{rating}</b><span>{rating === 'NO' ? 'Not Observed' : rating === 'A' ? 'Acceptable' : rating === 'RT' ? 'Responding to Training' : rating === 'UA' ? 'Unacceptable' : 'Not Responding to Training'}</span></span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="monthly-rating-table w-full text-sm" data-testid="monthly-rating-table">
              <thead><tr><th scope="col">Performance category</th>{RATINGS.map(rating => <th scope="col" key={rating} className={ratingTone[rating]}>{rating}</th>)}</tr></thead>
              <tbody>
                {SEG_RATING_COLUMNS.flatMap(column => column).map(group => [
                  <tr key={`group-${group}`} className="monthly-rating-group"><th colSpan={6}>{SEG_RATING_GROUP_LABELS[group] ?? group}</th></tr>,
                  ...SEG_CATEGORIES.filter(category => category.group === group).map(category => (
                    <tr key={category.key} data-testid={`monthly-category-${category.key}`}>
                      <th scope="row">{category.label}</th>
                      {RATINGS.map(rating => <td key={rating} className={`mono text-center font-semibold ${ratingTone[rating]}`} data-testid={`monthly-count-${category.key}-${rating}`}>{summary.ratingCounts[category.key][rating]}</td>)}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Monthly activity totals" className="mb-4">
          <fieldset disabled className="grid grid-cols-1 border-l border-t sm:grid-cols-2 xl:grid-cols-4">
            {DAILY_ACTIVITY_COLUMNS.map(column => (
              <section key={column.title} className="min-w-0 border-b border-r bg-card">
                <h3 className="label-caps border-b bg-muted px-3 py-2">{column.title}</h3>
                <div className="divide-y">
                  {column.keys.map(key => {
                    const field = DAILY_ACTIVITY_FIELDS.find(item => item.key === key);
                    if (!field) return null;
                    return <div key={key} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-x-2 px-3 py-2">
                      <span className="text-xs leading-4">{field.label}</span>
                      <output className="rounded-sm border bg-card px-2 py-2 text-right mono text-sm font-bold" data-testid={`monthly-activity-${key}`}>{summary.activityTotals[key]}</output>
                    </div>;
                  })}
                </div>
              </section>
            ))}
          </fieldset>
        </Panel>

        <PrintableMonthlySummary
          reports={reports}
          monthKey={monthKey}
          ratingCounts={summary.ratingCounts}
          activityTotals={summary.activityTotals}
          reviewedLogCount={summary.reviewedLogCount}
        />
      </>}
    </div>
  );
}
