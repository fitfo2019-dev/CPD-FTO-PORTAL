import { PRIMARY_RUN_FORMS, type AddedDeficiency, type Category, type Report } from './model.js';
import type { OperationalPacket } from './operational-state-machine.js';
import { formatDateTimeMDY } from './training-calendar.js';
import { addedDeficiencyGroupId } from './seg-deficiencies.js';

export interface AddedDeficiencyInput {
  runId: string;
  whatHappened: string;
  correctiveTraining: string;
  minutes: number;
  sameIssueAs?: string;
}

/** Runs on this daily log, labeled by training-folder page. Added UA's are always tied to a run. */
export function addedUaRunOptions(report: Report, packet: OperationalPacket | undefined): { runId: string; label: string }[] {
  const runs = new Map(report.runs.map(run => [run.id, run]));
  return (packet?.pages ?? []).filter(page => page.kind === 'run' && page.runId && runs.has(page.runId)).map(page => {
    const run = runs.get(page.runId!)!;
    const form = PRIMARY_RUN_FORMS.find(item => item.key === run.runKind)?.label ?? page.title;
    return { runId: run.id, label: [page.reference ?? `Page ${page.page}`, form, formatDateTimeMDY(run.occurredAt)].filter(Boolean).join(' · ') };
  });
}

const issueKey = (reportId: string, groupId: string) => `${reportId}|${groupId}`;

/** Earlier UA's for this PO, phase and category, so the FTO can mark a repeat of the same issue. */
export function addedUaIssueOptions(reports: readonly Report[], report: Report, category: Category, excludeAddedId?: string): { id: string; label: string }[] {
  const sameTrainee = (item: Report) => item.recruitBadge === report.recruitBadge && (item.className ?? '') === (report.className ?? '') && item.phase === report.phase;
  const earlier = reports.filter(item => item.id !== report.id && sameTrainee(item) && item.date < report.date && !item.limboDay)
    .sort((left, right) => left.date.localeCompare(right.date));
  const options: { id: string; label: string }[] = [];
  for (const item of [...earlier, report]) {
    for (const group of item.checklistDeficiencies ?? []) {
      if (group.category !== category || (excludeAddedId && group.addedId === excludeAddedId)) continue;
      const reference = [...new Set(group.tasks.map(task => task.reference).filter(Boolean))].join(', ') || 'Reference pending';
      const text = group.narrative.trim().replace(/\s+/g, ' ');
      options.push({ id: issueKey(item.id, group.id), label: `${reference} · ${text.length > 70 ? `${text.slice(0, 69)}…` : text}` });
    }
  }
  return options;
}

export function saveAddedDeficiency(report: Report, category: Category, input: AddedDeficiencyInput, editingId: string | undefined, id: string, now: string): Report {
  if (!report.runs.some(run => run.id === input.runId)) throw new Error('An added UA must be linked to a run on this daily log.');
  if (!input.whatHappened.trim() || !input.correctiveTraining.trim()) throw new Error('An added UA requires what happened and the corrective training.');
  if (!Number.isInteger(input.minutes) || input.minutes < 1) throw new Error('An added UA requires the corrective training minutes.');
  const existing = editingId ? report.addedDeficiencies?.find(item => item.id === editingId) : undefined;
  if (editingId && !existing) throw new Error('The added UA being edited no longer exists.');
  const entry: AddedDeficiency = {
    id: existing?.id ?? id, runId: input.runId, category,
    whatHappened: input.whatHappened.trim(), correctiveTraining: input.correctiveTraining.trim(), minutes: input.minutes,
    ...(input.sameIssueAs ? { sameIssueAs: input.sameIssueAs } : {}),
    createdAt: existing?.createdAt ?? now,
  };
  const list = existing
    ? (report.addedDeficiencies ?? []).map(item => item.id === existing.id ? entry : item)
    : [...(report.addedDeficiencies ?? []), entry];
  return { ...report, deficiencyAutomationEnabled: true, ratingsReviewedAt: undefined, addedDeficiencies: list };
}

export function removeAddedDeficiency(report: Report, id: string): Report {
  const target = report.addedDeficiencies?.find(item => item.id === id);
  if (!target) return report;
  const groupId = addedDeficiencyGroupId(target);
  const referencing = (value?: string) => !!value && value.endsWith(`|${groupId}`);
  const otherInCategory = (report.checklistDeficiencies ?? []).some(group => group.category === target.category && group.id !== groupId);
  return { ...report, ratingsReviewedAt: undefined,
    addedDeficiencies: (report.addedDeficiencies ?? []).filter(item => item.id !== id)
      .map(item => { if (!referencing(item.sameIssueAs)) return item; const { sameIssueAs: _removed, ...rest } = item; return rest; }),
    ...(otherInCategory ? {} : { deficiencySafetyLocks: report.deficiencySafetyLocks?.filter(category => category !== target.category) }),
  };
}

export function parseAddedUaMinutes(value: string): number | undefined {
  if (!/^\d{1,3}$/.test(value.trim())) return undefined;
  const minutes = Number(value.trim());
  return minutes >= 1 ? minutes : undefined;
}
