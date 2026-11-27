import { CATEGORIES, type Category, type ChecklistDeficiencyGroup, type Report, type RunUaBox, type TrainingRun } from './model.js';
import { runFailureStatements } from './run-failure-statements.js';

/** Minute choices on the run UA box; nothing is pre-filled (owner, Nov 27, 2026). */
export const UA_MINUTE_CHOICES = [5, 10, 15, 20, 30] as const;

export function parseUaMinutes(value: string): number | undefined {
  if (!/^\d{1,3}$/.test(value.trim())) return undefined;
  const minutes = Number(value.trim());
  return minutes >= 1 ? minutes : undefined;
}

type RunText = Parameters<typeof runFailureStatements>[0] & Pick<TrainingRun, 'uaBox'>;
type IdentifiedRunText = RunText & Pick<TrainingRun, 'id'>;

/** "PO failed to" sentences, in checklist order, as edited by the FTO. */
export function runFailureSentences(run: RunText): string[] {
  return runFailureStatements(run).map(statement => statement.text.trim()).filter(Boolean);
}

/** The run's UA articulation as one paragraph: sentences, the FTO's added detail, then the corrective training. */
export function runUaParagraph(run: RunText): string {
  return [...runFailureSentences(run), run.uaBox?.whatHappened?.trim(), run.uaBox?.correctiveTraining?.trim()]
    .filter((part): part is string => !!part).join(' ');
}

/** Run narrative as printed: the FTO's summary of the run, then the UA box text (written once, page 63). */
export function fullRunNarrative(run: RunText & Pick<TrainingRun, 'narrative'>): string {
  return [run.narrative?.trim(), runUaParagraph(run)].filter(Boolean).join('\n\n');
}

export type UaBoxGap = 'whatHappened' | 'correctiveTraining' | 'minutes';

/** What the run's UA box still needs before ratings review; empty when the run has no UA's. */
export function runUaBoxGaps(run: IdentifiedRunText, groups: readonly ChecklistDeficiencyGroup[]): UaBoxGap[] {
  const mine = groups.filter(group => group.runId === run.id);
  if (!mine.length) return [];
  const gaps: UaBoxGap[] = [];
  const hasSentence = runFailureSentences(run).length > 0;
  if (mine.some(group => group.added) && !run.uaBox?.whatHappened?.trim()) gaps.push('whatHappened');
  else if (!hasSentence && !run.uaBox?.whatHappened?.trim()) gaps.push('whatHappened');
  if (!run.uaBox?.correctiveTraining?.trim()) gaps.push('correctiveTraining');
  if (!Number.isInteger(run.uaBox?.minutes) || (run.uaBox?.minutes ?? 0) < 1) gaps.push('minutes');
  return gaps;
}

/** Drop empty fields and categories that an unchecked box already captures. */
export function normalizeUaBox(box: RunUaBox | undefined, checklistCategories: readonly Category[]): RunUaBox | undefined {
  if (!box) return undefined;
  const added = [...new Set(box.addedCategories ?? [])].filter(category => CATEGORIES.includes(category) && !checklistCategories.includes(category));
  const all = new Set<Category>([...checklistCategories, ...added]);
  const sameIssueAs = Object.fromEntries(Object.entries(box.sameIssueAs ?? {}).filter(([category, value]) => all.has(category as Category) && !!value));
  const next: RunUaBox = {
    ...(added.length ? { addedCategories: added } : {}),
    ...(box.whatHappened?.trim() ? { whatHappened: box.whatHappened } : {}),
    ...(box.correctiveTraining?.trim() ? { correctiveTraining: box.correctiveTraining } : {}),
    ...(Number.isInteger(box.minutes) && (box.minutes ?? 0) >= 1 ? { minutes: box.minutes } : {}),
    ...(Object.keys(sameIssueAs).length ? { sameIssueAs } : {}),
  };
  return Object.keys(next).length ? next : undefined;
}

export const uaIssueKey = (reportId: string, groupId: string) => `${reportId}|${groupId}`;

/**
 * Earlier UA's for this PO, class and phase in the same category, offered as a one-tap "Same issue as" suggestion.
 * Nothing is linked until the FTO taps it (owner, Nov 27, 2026).
 */
export function uaIssueSuggestions(reports: readonly Report[], report: Report, runId: string, category: Category, draftOccurredAt?: string): { id: string; label: string; shortLabel: string }[] {
  const sameTrainee = (item: Report) => item.recruitBadge === report.recruitBadge && (item.className ?? '') === (report.className ?? '') && item.phase === report.phase;
  const earlier = reports.filter(item => item.id !== report.id && sameTrainee(item) && item.date < report.date && !item.limboDay)
    .sort((left, right) => left.date.localeCompare(right.date));
  // A run still being entered is not in report.runs yet; use its entered time.
  const runAt = report.runs.find(run => run.id === runId)?.occurredAt ?? draftOccurredAt ?? '';
  const sameDayEarlier = (group: ChecklistDeficiencyGroup) => {
    const at = report.runs.find(run => run.id === group.runId)?.occurredAt ?? '';
    return group.runId !== runId && at < runAt;
  };
  const options: { id: string; label: string; shortLabel: string }[] = [];
  for (const item of [...earlier, report]) {
    for (const group of item.checklistDeficiencies ?? []) {
      if (group.category !== category || (item.id === report.id && !sameDayEarlier(group))) continue;
      const reference = [...new Set(group.tasks.map(task => task.reference).filter(Boolean))].join(', ') || 'Reference pending';
      const text = group.narrative.trim().replace(/\s+/g, ' ');
      // The button shows the full sentence; the earlier-UA list keeps a short form.
      options.push({ id: uaIssueKey(item.id, group.id), label: `${reference} · ${text}`, shortLabel: `${reference} · ${text.length > 70 ? `${text.slice(0, 69)}…` : text}` });
    }
  }
  return options;
}
