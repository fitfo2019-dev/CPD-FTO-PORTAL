import {
  DAILY_ACTIVITY_COLUMNS,
  DAILY_ACTIVITY_FIELDS,
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
  const activityRows = Math.max(...DAILY_ACTIVITY_COLUMNS.map(column => column.keys.length));
  const monthDates = reports.map(report => report.date).sort();
  const assignments = [...new Set(reports.map(report => phaseAssignmentLabel(report.ftoAssignment, report.shift)))].join(', ');
  return (
    <section className="print-monthly" aria-hidden="true" data-testid="print-monthly-summary">
      <header className="print-monthly-header">
        <div>
          <p>Columbus Division of Police · Field Training Program</p>
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

      <section className="print-monthly-ratings">
        <h2>Monthly rating counts by SEG category</h2>
        <div className="print-monthly-legend">
          {RATINGS.map(rating => <span key={rating} className={ratingClass[rating]}><b>{rating}</b>{ratingLabel[rating]}</span>)}
        </div>
        <table className="print-monthly-rating-table">
          <colgroup><col className="print-monthly-category-column" />{RATINGS.map(rating => <col key={rating} className="print-monthly-rating-column" />)}</colgroup>
          <thead><tr><th>Performance category</th>{RATINGS.map(rating => <th key={rating} className={ratingClass[rating]}>{rating}</th>)}</tr></thead>
          <tbody>
            {SEG_RATING_COLUMNS.flatMap(column => column).map(group => [
              <tr key={`group-${group}`}><th colSpan={6}>{SEG_RATING_GROUP_LABELS[group] ?? group}</th></tr>,
              ...SEG_CATEGORIES.filter(category => category.group === group).map(category => (
                <tr key={category.key}>
                  <td>{category.label}</td>
                  {RATINGS.map(rating => <td key={rating} className={ratingClass[rating]}>{ratingCounts[category.key][rating]}</td>)}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </section>

      <section className="print-monthly-activity">
        <h2>Monthly activity totals</h2>
        <p className="print-monthly-activity-subtitle">{formatMonth(monthKey)} · {first.recruitName} · {assignments || 'No assignment recorded'}</p>
        <table className="print-monthly-activity-table">
          <colgroup>{DAILY_ACTIVITY_COLUMNS.flatMap((_, index) => [
            <col key={`label-${index}`} className="print-monthly-activity-label" />,
            <col key={`total-${index}`} className="print-monthly-activity-total" />,
          ])}</colgroup>
          <thead>
            <tr>{DAILY_ACTIVITY_COLUMNS.map(column => <th key={column.title} colSpan={2}>{column.title}</th>)}</tr>
            <tr>{DAILY_ACTIVITY_COLUMNS.flatMap((_, index) => [
              <th key={`activity-${index}`}>Activity</th>,
              <th key={`count-${index}`}>Total</th>,
            ])}</tr>
          </thead>
          <tbody>
            {Array.from({ length: activityRows }, (_, rowIndex) => (
              <tr key={`activity-row-${rowIndex}`}>
                {DAILY_ACTIVITY_COLUMNS.map((column, columnIndex) => {
                  const key = column.keys[rowIndex];
                  const field = key ? DAILY_ACTIVITY_FIELDS.find(item => item.key === key) : undefined;
                  return field
                    ? [
                      <td key={`label-${columnIndex}-${key}`}>{field.label}</td>,
                      <td key={`total-${columnIndex}-${key}`} className="print-monthly-total">{activityTotals[field.key]}</td>,
                    ]
                    : [
                      <td key={`label-blank-${columnIndex}`} />,
                      <td key={`total-blank-${columnIndex}`} />,
                    ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="print-monthly-footer">Local workspace summary · Not server-confirmed · Generated {formatDateDMY(new Date().toISOString().slice(0, 10))}</footer>
    </section>
  );
}
