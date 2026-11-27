import type { Report } from "@/lib/model.js";
import { applyUaCounting } from "@/lib/seg-deficiencies.js";
import type { Occurrence } from "./nrt.js";

/**
 * UA history for the NRT recommendation (PO-NRT-1). Owner decisions, Nov 26, 2026: added UA's count toward NRT when
 * the FTO links them as the same issue as an earlier UA, and documented-only UA's (not counted in the weekly totals)
 * still count toward NRT because they are part of the prior documentation the manual requires the FTO to review.
 */
export function uaOccurrences(reports: readonly Report[]): Occurrence[] {
  const ordered = [...reports].filter((report) => report.ratingsReviewedAt && !report.limboDay)
    .sort((left, right) => left.date.localeCompare(right.date));
  const taskOf = new Map<string, string>();
  const occurrences: Occurrence[] = [];
  for (const report of ordered) {
    const runs = new Map(report.runs.map((run) => [run.id, run]));
    const added = new Map((report.addedDeficiencies ?? []).map((item) => [item.id, item]));
    for (const group of applyUaCounting(report.checklistDeficiencies ?? [], report)) {
      const run = group.runId ? runs.get(group.runId) : undefined;
      const at = run?.occurredAt ?? `${report.date}T00:00:00`;
      const key = `${report.id}|${group.id}`;
      if (group.addedId) {
        const source = added.get(group.addedId);
        const task = (source?.sameIssueAs && taskOf.get(source.sameIssueAs)) || `${group.category}.added:${group.addedId}`;
        taskOf.set(key, task);
        occurrences.push({ id: key, phase: report.phase, task, at, retrainedAt: run?.endedAt ?? at, retrainMinutes: group.minutes ?? null });
        continue;
      }
      for (const item of group.tasks) {
        const task = `${group.category}.${item.id.split(":").pop()}`;
        taskOf.set(key, taskOf.get(key) ?? task);
        occurrences.push({ id: `${key}|${item.id}`, phase: report.phase, task, at, retrainedAt: null, retrainMinutes: null });
      }
    }
  }
  return occurrences;
}
