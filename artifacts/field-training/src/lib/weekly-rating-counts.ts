import type { Category, Rating, Report } from './model.js';

export function categoryHasApplicableDeficiency(report:Report,category:Category):boolean {
  return report.checklistDeficiencies?.some(group=>group.category===category)===true
    || report.ratings?.[category]?.rating==='UA';
}

export function categoryIsNotApplicable(report:Report,category:Category):boolean {
  return report.notApplicableCategories?.includes(category)===true
    && !categoryHasApplicableDeficiency(report,category);
}

export function effectiveCategoryRating(report:Report,category:Category):Rating {
  if(categoryIsNotApplicable(report,category))return '';
  return report.ratings?.[category]?.rating??'';
}

/** Incident/category evidence counts once; a weekly deficiency precludes an A ceiling. */
export function weeklyRatingCount(reports: readonly Report[], category: Category, rating: Exclude<Rating, ''>): number {
  const hasDeficiency = reports.some(report => report.ratingsReviewedAt && !report.limboDay && categoryHasApplicableDeficiency(report,category));
  if (rating === 'A' && hasDeficiency) return 0;
  return reports.filter(report => report.ratingsReviewedAt && !report.limboDay).reduce((count, report) => {
    const groups = report.checklistDeficiencies?.filter(group => group.category === category) ?? [];
    if (groups.length && rating === 'UA' && report.ratings[category]?.rating !== 'NRT') return count + groups.length;
    return count + (effectiveCategoryRating(report,category) === rating ? 1 : 0);
  }, 0);
}
