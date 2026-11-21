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
  const assignmentLabel=assignment??phaseAssignmentLabel(first?.ftoAssignment,first?.shift);
  return (
    <section
      className="print-summary"
      aria-hidden="true"
      data-testid="print-weekly-summary"
    >
      <header className="print-summary-header">
        <div>
          <p>Columbus Division of Police · Field Training Program</p>
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
      <table className="print-summary-rating-table">
        <thead>
          <tr>
            <th>Performance category</th>
            {RATINGS.map((rating) => <th key={rating}>{rating}</th>)}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_GROUPS.map((group) => [
            <tr key={`group-${group}`} className="print-summary-group-row">
              <th colSpan={6}>{group} · weekly count</th>
            </tr>,
            ...SEG_CATEGORIES.filter((item) => item.group === group).map(({ key, label }) => (
              <tr key={key}>
                <td>{label}</td>
                {RATINGS.map((rating) => (
                  <td
                    key={rating}
                    className={`print-summary-rating-${rating.toLowerCase()}${
                      rating === "UA" || rating === "NRT" ? " print-summary-flag" : ""
                    }`}
                  >
                    {ratingReports.reduce(
                      (count, report) => count + (report.ratings[key]?.rating === rating ? 1 : 0),
                      0,
                    )}
                  </td>
                ))}
              </tr>
            )),
          ])}
        </tbody>
      </table>
      <table className="print-summary-activity">
        <thead>
          <tr>
            <th colSpan={6}>Weekly Activity Summary · totals</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(
            { length: Math.ceil(DAILY_ACTIVITY_FIELDS.length / 6) },
            (_, row) => (
              <tr key={row}>
                {DAILY_ACTIVITY_FIELDS.slice(row * 6, row * 6 + 6).map(
                  ({ key, label }) => (
                    <td key={key}>
                      <span>{label}</span>
                      <b>
                        {reports.reduce(
                          (total, report) =>
                            total + activityTotals(report)[key],
                          0,
                        )}
                      </b>
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p className="print-summary-note">
        Numbers in the evaluation columns count reviewed daily selections for
        each descriptive rating; unreviewed defaults are excluded. They are not
        numeric performance ratings.
      </p>
      <footer className="print-summary-footer">
        Weekly Performance Summary · U-10.173 · Prepared from {reports.length}{" "}
        local daily log(s)
      </footer>
    </section>
  );
}
