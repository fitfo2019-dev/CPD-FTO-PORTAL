import {
  RATING_LEGEND,
  RATINGS,
  SEG_CATEGORIES,
  SEG_RATING_COLUMNS,
  SEG_RATING_GROUP_LABELS,
  phaseAssignmentLabel,
  type DailyActivitySummary,
  type Report,
} from '@/lib/model.js';
import type { MonthlyRatingCounts } from '@/lib/monthly-summary.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from '@/components/printable-columbus-header.js';
import { PrintDocument } from '@/components/print-template.js';
import { printRatingColumns } from '@/lib/print-rating-layout.js';
import { PrintActivityTotals } from '@/components/print-activity-totals.js';

const ratingLabel: Record<string, string> = Object.fromEntries(RATING_LEGEND.map(({ code, label }) => [code, label]));
const ratingClass: Record<string, string> = {
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

export function PrintableMonthlySummary({
  reports,
  monthKey,
  ratingCounts,
  activityTotals,
  reviewedLogCount,
}: {
  reports: Report[];
  monthKey: string;
  ratingCounts: MonthlyRatingCounts;
  activityTotals: DailyActivitySummary;
  reviewedLogCount: number;
}) {
  if (!reports.length) return null;
  const first = reports[0];
  const ratingColumns=printRatingColumns(SEG_RATING_COLUMNS.flat());
  const ratingRows=ratingColumns.map(column=>column.flatMap(group=>[
    { kind:'group' as const,group },
    ...SEG_CATEGORIES.filter(category=>category.group===group).map(category=>({kind:'category' as const,category})),
  ]));
  const monthDates = reports.map(report => report.date).sort();
  const assignments = [...new Set(reports.map(report => phaseAssignmentLabel(report.ftoAssignment, report.shift, report.cruiserDistrict)))].join(', ');
  return (
    <PrintDocument as="section" landscape className="print-monthly" aria-hidden="true" data-testid="print-monthly-summary">
      <header className="print-monthly-header">
        <div>
          <PrintableColumbusHeader formId="monthly_summary" />
          <h1>Monthly Performance Summary</h1>
        </div>
        <b>{formatMonth(monthKey)}</b>
      </header>
      <div className="print-monthly-meta">
        <span><b>Probationary Officer</b>{first.recruitName}</span>
        <span><b>Badge</b>{first.recruitBadge}</span>
        <span><b>Class</b>{first.className || 'Unassigned class'}</span>
        <span><b>Daily logs</b>{reports.length} saved · {reviewedLogCount} reviewed</span>
        <span><b>Date range</b>{formatDateDMY(monthDates[0])}–{formatDateDMY(monthDates[monthDates.length - 1])}</span>
        <span><b>FTO assignments</b>{assignments || 'Not recorded'}</span>
      </div>
      <p className="print-monthly-note">Rating counts include reviewed daily summaries only. Activity totals sum saved daily values and explicitly selected activity from completed, reviewed runs. Source records remain unchanged.</p>

      <div className="print-summary-panels"><section className="print-monthly-ratings">
        <h2>Monthly rating counts by SEG category</h2>
        <div className="print-monthly-legend">
          {RATINGS.map(rating => <span key={rating} className={ratingClass[rating]}><b>{rating}</b>{ratingLabel[rating]}</span>)}
        </div>
        <table className="print-monthly-rating-table">
          <colgroup>{ratingColumns.flatMap((_,index)=>[
            <col key={`label-${index}`} className="print-rating-label-column" />,
            ...RATINGS.map(rating=><col key={`${index}-${rating}`} className="print-rating-choice-column" />),
          ])}</colgroup>
          <thead><tr>{ratingColumns.flatMap((_,index)=>[
            <th key={`label-${index}`}>Performance category</th>,
            ...RATINGS.map(rating=><th key={`${index}-${rating}`} className={ratingClass[rating]}>{rating}</th>),
          ])}</tr></thead>
          <tbody>
            {Array.from({length:Math.max(...ratingRows.map(rows=>rows.length))},(_,rowIndex)=>
              <tr key={rowIndex}>{ratingRows.flatMap((rows,columnIndex)=>{
                const row=rows[rowIndex];
                if(!row)return [<td key={`blank-${columnIndex}`} colSpan={6} className="print-rating-empty" aria-hidden="true" />];
                if(row.kind==='group')return [<th key={`group-${columnIndex}`} colSpan={6} className="print-rating-group-cell">{SEG_RATING_GROUP_LABELS[row.group]??row.group}</th>];
                return [
                  <td key={`label-${columnIndex}`}>{row.category.label}</td>,
                  ...RATINGS.map(rating=><td key={`${columnIndex}-${rating}`} className={ratingClass[rating]}>{ratingCounts[row.category.key][rating]}</td>),
                ];
              })}</tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="print-monthly-activity">
        <h2>Monthly activity totals</h2>
        <p className="print-monthly-activity-subtitle">{formatMonth(monthKey)} · {first.recruitName} · {assignments || 'No assignment recorded'}</p>
        <PrintActivityTotals totals={activityTotals}/>
      </section>
      </div>
      <footer className="print-monthly-footer">Local workspace summary · Not server-confirmed · Generated {formatDateDMY(new Date().toISOString().slice(0, 10))}<PrintableColumbusFooterMarks /></footer>
    </PrintDocument>
  );
}
