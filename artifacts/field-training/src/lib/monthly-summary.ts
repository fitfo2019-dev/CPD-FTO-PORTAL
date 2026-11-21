import {
  DAILY_ACTIVITY_FIELDS,
  RATINGS,
  SEG_CATEGORIES,
  emptyDailyActivitySummary,
  type Category,
  type DailyActivitySummary,
  type Report,
  type Rating,
} from './model.js';
import { activityTotals as manualActivityTotals } from './run-activity.js';

export type MonthlyRatingCounts = Record<Category, Record<Exclude<Rating, ''>, number>>;

export function summarizeMonthlyReports(reports: Report[]) {
  const reviewedReports = reports.filter(report => !!report.ratingsReviewedAt && !report.limboDay);
  const ratingCounts = Object.fromEntries(
    SEG_CATEGORIES.map(({ key }) => [
      key,
      Object.fromEntries(RATINGS.map(rating => [
        rating,
        reviewedReports.reduce((count, report) => count + (report.ratings[key]?.rating === rating ? 1 : 0), 0),
      ])),
    ]),
  ) as MonthlyRatingCounts;
  const activityTotals = reports.reduce((total, report) => {
    const reportTotals = manualActivityTotals(report);
    for (const { key } of DAILY_ACTIVITY_FIELDS) total[key] += Number(reportTotals[key]) || 0;
    return total;
  }, emptyDailyActivitySummary() as DailyActivitySummary);

  return {
    savedLogCount: reports.length,
    reviewedLogCount: reviewedReports.length,
    ratingCounts,
    activityTotals,
  };
}
