import {
  CATEGORY_GROUPS,
  DAILY_ACTIVITY_FIELDS,
  phaseAssignmentLabel,
  RATING_LEGEND,
  SEG_CATEGORIES,
  type Report,
} from "@/lib/model.js";
import { formatDateDMY } from "@/lib/training-calendar.js";
import { activityTotals } from "@/lib/run-activity.js";
import { weeklyRatingCount } from "@/lib/weekly-rating-counts.js";
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from "@/components/printable-columbus-header.js";
import { PrintDocument } from "@/components/print-template.js";
import { printRatingColumns } from "@/lib/print-rating-layout.js";
import { PrintActivityTotals } from "@/components/print-activity-totals.js";

const RATINGS = ["NO", "A", "RT", "UA", "NRT"] as const;

export function PrintableWeeklySummary({
  reports,
  ratingReports = reports,
  weekNumber,
  weekStart,
  weekEnd,
  assignment,
}: {
  reports: Report[];
  ratingReports?: Report[];
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  assignment?: string;
}) {
  const first = reports[0];
  const assignmentLabel=assignment??phaseAssignmentLabel(first?.ftoAssignment,first?.shift,first?.cruiserDistrict);
  const ratingColumns = printRatingColumns(CATEGORY_GROUPS);
  const ratingRows = ratingColumns.map(column => column.flatMap(group => [
    { kind: 'group' as const, group },
    ...SEG_CATEGORIES.filter(item => item.group === group).map(item => ({ kind: 'category' as const, item })),
  ]));
  return (
    <PrintDocument as="section" landscape
      className="print-summary"
      aria-hidden="true"
      data-testid="print-weekly-summary"
    >
      <header className="print-summary-header">
        <div>
          <PrintableColumbusHeader formId="U-10.173" />
          <h1>Probationary Officer Weekly Performance Summary</h1>
          <b>U-10.173</b>
        </div>
        <div className="print-summary-week">
          {weekNumber ? `Week ${weekNumber}` : "Week number not set"}
          <br />
          {formatDateDMY(weekStart)}–{formatDateDMY(weekEnd)}
        </div>
      </header>
      <div className="print-summary-meta">
        <span>
          <b>FTO</b>
          {first?.ftoName || "—"} · Badge {first?.ftoBadge || "—"}
        </span>
        <span>
          <b>Probationary Officer</b>
          {first?.recruitName || "—"} · Badge {first?.recruitBadge || "—"}
        </span>
        <span>
          <b>Phase</b>
          {first?.phase ?? "—"}
        </span>
        <span>
          <b>FTO assignment</b>
          {assignmentLabel}
        </span>
        <span>
          <b>Daily logs included</b>
          {reports.length}
        </span>
      </div>
      <div className="print-summary-rating-legend" aria-label="Rating key">
        {RATING_LEGEND.map(({ code, label }) => (
          <span key={code} className={`print-summary-rating-${code.toLowerCase()}`}>
            <b>{code}</b>{label}
          </span>
        ))}
      </div>
      <div className="print-summary-panels"><table className="print-summary-rating-table">
        <colgroup>{ratingColumns.flatMap((_,index) => [
          <col key={`label-${index}`} className="print-rating-label-column" />,
          ...RATINGS.map(rating => <col key={`${index}-${rating}`} className="print-rating-choice-column" />),
        ])}</colgroup>
        <thead>
          <tr>
            {ratingColumns.flatMap((_,index) => [
              <th key={`label-${index}`}>Performance category</th>,
              ...RATINGS.map(rating => <th key={`${index}-${rating}`}>{rating}</th>),
            ])}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(...ratingRows.map(rows => rows.length)) },(_,rowIndex) =>
            <tr key={rowIndex}>{ratingRows.flatMap((rows,columnIndex) => {
              const row=rows[rowIndex];
              if (!row) return [<td key={`blank-${columnIndex}`} colSpan={6} className="print-rating-empty" aria-hidden="true" />];
              if (row.kind==='group') return [<th key={`group-${columnIndex}`} colSpan={6} className="print-rating-group-cell">{row.group} · weekly count</th>];
              return [
                <td key={`label-${columnIndex}`}>{row.item.label}</td>,
                ...RATINGS.map(rating => <td key={`${columnIndex}-${rating}`} className={`print-summary-rating-${rating.toLowerCase()}${rating==='UA'||rating==='NRT'?' print-summary-flag':''}`}>{weeklyRatingCount(reports,row.item.key,rating)}</td>),
              ];
            })}</tr>
          )}
        </tbody>
      </table>
      <section><h2>Weekly Activity Summary · totals</h2><PrintActivityTotals totals={Object.fromEntries(DAILY_ACTIVITY_FIELDS.map(({key})=>[
        key,reports.reduce((total,report)=>total+activityTotals(report)[key],0),
      ])) as ReturnType<typeof activityTotals>}/></section>
      </div><p className="print-summary-note">
        Numbers in the evaluation columns count reviewed daily selections for
        each descriptive rating; unreviewed defaults are excluded. They are not
        numeric performance ratings.
      </p>
      <footer className="print-summary-footer">
        Weekly Performance Summary · U-10.173 · Prepared from {reports.length}{" "}
        local daily log(s)
        <PrintableColumbusFooterMarks />
      </footer>
    </PrintDocument>
  );
}
