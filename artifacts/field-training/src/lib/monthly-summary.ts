import {
  DAILY_ACTIVITY_FIELDS,
  RATINGS,
  SEG_CATEGORIES,
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  emptyDailyActivitySummary,
  type Category,
  type DailyActivitySummary,
  type Report,
  type Rating,
  type TrainingRun,
} from './model.js';
import { activityTotals as manualActivityTotals, runDerivedActivityCounts } from './run-activity.js';

export type MonthlyRatingCounts = Record<Category, Record<Exclude<Rating, ''>, number>>;

export function filterReportsForMonth(reports: readonly Report[], monthKey: string): Report[] {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return [];
  return reports
    .filter(report => report.date.slice(0, 7) === monthKey)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function summarizeMonthlyRunRecords(reports: readonly Report[]) {
  const reviewedRuns = reports.flatMap(report =>
    (report.runs ?? [])
      .filter(run => run.formStatus === 'complete' && !!run.checklistReviewedAt)
      .map(run => ({ report, run })),
  );
  const runChecklistItems = new Map<string, {
    form: string;
    section: string;
    item: string;
    runCount: number;
    selectedCount: number;
    notApplicableCount: number;
    sourceReportIds: Set<string>;
    sourceRunIds: Set<string>;
    sourceRunRefs: Set<string>;
  }>();

  const addChecklistRows = (
    report: Report,
    run: TrainingRun,
    formKey: string,
    formLabel: string,
    sections: readonly { title: string; items: readonly { label: string }[] }[],
    prefix: string,
    notApplicableKey: string,
  ) => {
    let offset = 0;
    const notApplicable = run.checklist?.[notApplicableKey] === true;
    for (const section of sections) {
      for (const item of section.items) {
        const checklistKey = `${prefix}${offset}`;
        offset += 1;
        const key = `${formKey}|${section.title}|${item.label}`;
        const row = runChecklistItems.get(key) ?? {
          form: formLabel,
          section: section.title || 'Checklist',
          item: item.label,
          runCount: 0,
          selectedCount: 0,
          notApplicableCount: 0,
          sourceReportIds: new Set<string>(),
          sourceRunIds: new Set<string>(),
          sourceRunRefs: new Set<string>(),
        };
        const runReference = `${report.id}|${run.id}`;
        if (!row.sourceRunRefs.has(runReference)) {
          row.runCount += 1;
          if (notApplicable) row.notApplicableCount += 1;
          else if (run.checklist?.[checklistKey] !== false) row.selectedCount += 1;
          row.sourceRunRefs.add(runReference);
        }
        row.sourceReportIds.add(report.id);
        row.sourceRunIds.add(run.id);
        runChecklistItems.set(key, row);
      }
    }
  };

  for (const { report, run } of reviewedRuns) {
    const primary = PRIMARY_RUN_FORMS.find(form => form.key === run.runKind);
    if (primary) {
      addChecklistRows(
        report,
        run,
        primary.key,
        primary.label,
        RUN_CHECKLIST_SECTIONS[run.runKind],
        'task-',
        'na-task',
      );
    }
    for (const formKey of requiredSupplementalForms(run)) {
      const form = SUPPLEMENTAL_RUN_FORMS.find(item => item.key === formKey);
      if (!form) continue;
      addChecklistRows(
        report,
        run,
        formKey,
        form.label,
        RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey],
        `supp-${formKey}-`,
        `na-supp-${formKey}`,
      );
    }
  }

  return {
    reviewedRunCount: reviewedRuns.length,
    activityFlagCounts: runDerivedActivityCounts(reviewedRuns.map(item => item.run)),
    arrestMadeRunCount: reviewedRuns.filter(({ run }) => run.arrestMade).length,
    transportedAfterArrestRunCount: reviewedRuns.filter(({ run }) => run.transportedAfterArrest).length,
    oviProcessedRunCount: reviewedRuns.filter(({ run }) => run.oviProcessed).length,
    checklistItems: [...runChecklistItems.values()].map(row => ({
      form: row.form,
      section: row.section,
      item: row.item,
      runCount: row.runCount,
      selectedCount: row.selectedCount,
      notApplicableCount: row.notApplicableCount,
      otherCount: Math.max(0, row.runCount - row.selectedCount - row.notApplicableCount),
      sourceReportIds: [...row.sourceReportIds],
      sourceRunIds: [...row.sourceRunIds],
    })),
  };
}

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
    runRecords: summarizeMonthlyRunRecords(reports),
  };
}
