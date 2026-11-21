import type { Category, Rating, Report } from './model.js';

/** Incident/category evidence counts once; a weekly deficiency precludes an A ceiling. */
export function weeklyRatingCount(reports: readonly Report[], category: Category, rating: Exclude<Rating, ''>): number {
  const hasDeficiency = reports.some(report => !report.limboDay && (
    report.checklistDeficiencies?.some(group => group.category === category) ||
    ['UA','RT','NRT'].includes(report.ratings[category]?.rating ?? '')
  ));
  if (rating === 'A' && hasDeficiency) return 0;
  return reports.filter(report => report.ratingsReviewedAt && !report.limboDay).reduce((count, report) => {
    const groups = report.checklistDeficiencies?.filter(group => group.category === category) ?? [];
    if (groups.length && rating === 'UA' && report.ratings[category]?.rating !== 'NRT') return count + groups.length;
    return count + (report.ratings[category]?.rating === rating ? 1 : 0);
  }, 0);
}
