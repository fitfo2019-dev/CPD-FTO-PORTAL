import {
  CATEGORY_LABEL,
  PRIMARY_RUN_FORMS,
  RATINGS,
  RUN_CHECKLIST_ITEMS,
  RUN_SUPPLEMENT_CHECKLIST_ITEMS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  type Rating,
  type Report,
  type TrainingRun,
} from './model.js';
import { formatDateDMY, getSundaySaturdayWeek } from './training-calendar.js';

export interface TimelineInterpolation {
  text: string;
  key: string;
  sourceReportIds: string[];
}

interface RatingObservation {
  category: keyof typeof CATEGORY_LABEL;
  rating: Exclude<Rating, ''>;
  date: string;
  reportId: string;
}

interface ReviewedRun {
  date: string;
  module: string;
  reportId: string;
  checkedItems: string[];
}

const isRating = (value: unknown): value is Exclude<Rating, ''> =>
  typeof value === 'string' && (RATINGS as readonly string[]).includes(value);

function reportDateInWeek(date: unknown, weekStart: string): date is string {
  if (typeof date !== 'string') return false;
  return getSundaySaturdayWeek(date)?.start === weekStart;
}

function dateLabel(date: string): string {
  return formatDateDMY(date);
}

function checkedRunItems(run: TrainingRun): string[] {
  const checklist = run.checklist;
  if (!checklist || typeof checklist !== 'object') return [];

  const primaryItems = RUN_CHECKLIST_ITEMS[run.runKind] ?? [];
  return primaryItems.flatMap((label, index) => {
    const taskId = `task-${index}`;
    return checklist[taskId] === true ? [`${taskId} — ${label}`] : [];
  });
}

function reviewedRuns(reports: readonly Report[]): ReviewedRun[] {
  const runs: ReviewedRun[] = [];

  for (const report of reports) {
    for (const run of report.runs ?? []) {
      if (run?.formStatus !== 'complete' || !run.checklistReviewedAt) continue;
      if (!PRIMARY_RUN_FORMS.some(form => form.key === run.runKind)) continue;

      const module = PRIMARY_RUN_FORMS.find(form => form.key === run.runKind)?.label
        ?? String(run.runKind || 'Unmapped run form');
      const date = report.date;
      runs.push({ date, module, reportId: report.id, checkedItems: checkedRunItems(run) });

      for (const formKey of requiredSupplementalForms(run)) {
        const supplemental = SUPPLEMENTAL_RUN_FORMS.find(form => form.key === formKey);
        if (!supplemental) continue;
        const items = RUN_SUPPLEMENT_CHECKLIST_ITEMS[formKey] ?? [];
        const selected = items.flatMap((label, index) => {
          const taskId = `supp-${formKey}-${index}`;
          return run.checklist?.[taskId] === true ? [`${taskId} — ${label}`] : [];
        });
        runs.push({
          date,
          module: supplemental.label,
          reportId: report.id,
          checkedItems: selected,
        });
      }
    }
  }

  return runs.sort((left, right) =>
    left.date.localeCompare(right.date) || left.module.localeCompare(right.module),
  );
}

function buildKey(reports: readonly Report[]): string {
  return JSON.stringify(reports.map(report => [
    report.id,
    report.date,
    report.updatedAt,
    report.ratingsReviewedAt ?? '',
    report.limboDay === true,
    Object.entries(report.ratings ?? {}).map(([category, entry]) => [
      category,
      entry?.rating ?? '',
    ]),
    (report.runs ?? []).map(run => [
      run?.id ?? '',
      run?.formStatus ?? '',
      run?.checklistReviewedAt ?? '',
      run?.runKind ?? '',
      run?.checklist ?? {},
    ]),
  ]));
}

export function buildTimelineInterpolation(
  reports: readonly Report[],
  weekStart: string | undefined,
  recruitBadge: string | undefined,
  className?: string,
): TimelineInterpolation {
  const empty: TimelineInterpolation = { text: '', key: '[]', sourceReportIds: [] };
  if (!weekStart || !getSundaySaturdayWeek(weekStart)?.start || !recruitBadge?.trim()) {
    return empty;
  }

  const weekReports = reports
    .filter(report =>
      report?.recruitBadge === recruitBadge
      && (className === undefined || (report.className ?? '') === className)
      && reportDateInWeek(report.date, weekStart),
    )
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));

  const key = buildKey(weekReports);
  const reviewedReports = weekReports.filter(report =>
    report.limboDay !== true
    && typeof report.ratingsReviewedAt === 'string'
    && report.ratingsReviewedAt.trim().length > 0,
  );

  const observations: RatingObservation[] = [];
  for (const report of reviewedReports) {
    for (const [category, entry] of Object.entries(report.ratings ?? {})) {
      if (!isRating(entry?.rating) || !(category in CATEGORY_LABEL)) continue;
      observations.push({
        category: category as keyof typeof CATEGORY_LABEL,
        rating: entry.rating,
        date: report.date,
        reportId: report.id,
      });
    }
  }
  observations.sort((left, right) =>
    left.date.localeCompare(right.date)
    || left.category.localeCompare(right.category)
    || left.reportId.localeCompare(right.reportId),
  );

  const runs = reviewedRuns(weekReports);
  if (observations.length === 0 && runs.length === 0) {
    return { text: '', key, sourceReportIds: [] };
  }

  const lines = [
    'System-generated weekly record draft: verify each entry against the reviewed source forms and edit before use. This summary is not an independent observation, assessment, or signature.',
  ];
  const sourceReportIds = new Set<string>();

  if (observations.length > 0) {
    for (const observation of observations) sourceReportIds.add(observation.reportId);

    const frequency = RATINGS
      .map(rating => ({
        rating,
        count: observations.filter(observation => observation.rating === rating).length,
      }))
      .filter(item => item.count > 0)
      .map(item => `${item.rating}: ${item.count}`)
      .join('; ');
    lines.push(`Reviewed rating frequencies (counts, not scores): ${frequency}.`);

    const acceptableByCategory = new Map<string, string[]>();
    const followUpByCategory = new Map<string, string[]>();
    const uaByCategory = new Map<string, string[]>();

    for (const observation of observations) {
      const label = CATEGORY_LABEL[observation.category];
      const entry = `${observation.rating} on ${dateLabel(observation.date)}`;
      if (observation.rating === 'A') {
        acceptableByCategory.set(label, [...(acceptableByCategory.get(label) ?? []), entry]);
      }
      if (observation.rating === 'UA' || observation.rating === 'RT' || observation.rating === 'NRT') {
        followUpByCategory.set(label, [...(followUpByCategory.get(label) ?? []), entry]);
      }
      if (observation.rating === 'UA') {
        uaByCategory.set(label, [...(uaByCategory.get(label) ?? []), dateLabel(observation.date)]);
      }
    }

    if (acceptableByCategory.size > 0) {
      lines.push(`Acceptable marks recorded: ${[...acceptableByCategory]
        .map(([category, entries]) => `${category} (${entries.map(entry => entry.split(' on ')[1]).join(', ')})`)
        .join('; ')}.`);
    }
    if (followUpByCategory.size > 0) {
      lines.push(`UA, RT, or NRT marks recorded for FTO review: ${[...followUpByCategory]
        .map(([category, entries]) => `${category} (${entries.join(', ')})`)
        .join('; ')}.`);
    }

    const transitions: string[] = [];
    for (const [category, entries] of groupByCategory(observations)) {
      for (let index = 1; index < entries.length; index += 1) {
        const previous = entries[index - 1];
        const current = entries[index];
        if (previous.date < current.date && previous.rating === 'UA' && (current.rating === 'A' || current.rating === 'RT')) {
          transitions.push(`${category}: UA on ${dateLabel(previous.date)} followed by ${current.rating} on ${dateLabel(current.date)}`);
        }
      }
    }
    if (transitions.length > 0) {
      lines.push(`Recorded rating changes within the selected week: ${transitions.join('; ')}. Verify each change against its source forms.`);
    }

    const repeatedUa = [...uaByCategory]
      .filter(([, dates]) => dates.length > 1)
      .map(([category, dates]) => `${category} (UA on ${dates.join(', ')})`);
    if (repeatedUa.length > 0) {
      lines.push(`Repeated UA marks in the same exact category: ${repeatedUa.join('; ')}.`);
    }

    if (observations.some(observation => observation.rating === 'NO')) {
      lines.push('NO means Not Observed; it is not treated as positive or deficient performance evidence.');
    }
  }

  if (runs.length > 0) {
    runs.forEach(run => sourceReportIds.add(run.reportId));
    const moduleGroups = new Map<string, ReviewedRun[]>();
    for (const run of runs) moduleGroups.set(run.module, [...(moduleGroups.get(run.module) ?? []), run]);
    lines.push(`Completed run forms with checklist review, by module: ${[...moduleGroups]
      .map(([module, entries]) => `${module} (${entries.length}; ${entries.map(entry => dateLabel(entry.date)).join(', ')})`)
      .join('; ')}.`);

    const checklistGroups = runs
      .filter(run => run.checkedItems.length > 0)
      .map(run => `${dateLabel(run.date)} · ${run.module}: ${run.checkedItems.join(', ')}`);
    if (checklistGroups.length > 0) {
      lines.push(`Checklist items marked after review: ${checklistGroups.join('; ')}.`);
    }
  }

  return {
    text: lines.join('\n\n'),
    key,
    sourceReportIds: [...sourceReportIds].sort(),
  };
}

function groupByCategory(observations: readonly RatingObservation[]) {
  const groups = new Map<string, RatingObservation[]>();
  for (const observation of observations) {
    const label = CATEGORY_LABEL[observation.category];
    groups.set(label, [...(groups.get(label) ?? []), observation]);
  }
  return groups;
}

/** Leading review notice on the weekly draft; removed where the text becomes form content. */
export const TIMELINE_DRAFT_PREAMBLE_PATTERN = /^System-generated weekly record draft:[^\n]*\n*/;
