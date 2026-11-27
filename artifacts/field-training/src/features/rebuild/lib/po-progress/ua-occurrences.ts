import type { Report } from "@/lib/model.js";
import { applyUaCounting } from "@/lib/seg-deficiencies.js";
import { uaIssueKey } from "@/lib/run-ua-box.js";
import type { Occurrence } from "./nrt.js";

/**
 * UA history for the NRT recommendation (PO-NRT-1). Owner decisions, Nov 26-27, 2026: added UA's count toward NRT
 * when the FTO links them as the same issue as an earlier UA; documented-only UA's (not counted in the weekly
 * totals) still count because they are prior documentation the manual requires the FTO to review; and a run's
 * corrective training counts for every category on that run (one UA box per run).
 */
export function uaOccurrences(reports: readonly Report[]): Occurrence[] {
  const ordered = [...reports].filter((report) => report.ratingsReviewedAt && !report.limboDay)
    .sort((left, right) => left.date.localeCompare(right.date));
  const taskOf = new Map<string, string>();
  const occurrences: Occurrence[] = [];
  for (const report of ordered) {
    const runs = new Map(report.runs.map((run) => [run.id, run]));
    for (const group of applyUaCounting(report.checklistDeficiencies ?? [], report)) {
      const run = group.runId ? runs.get(group.runId) : undefined;
      const at = run?.occurredAt ?? `${report.date}T00:00:00`;
      const key = uaIssueKey(report.id, group.id);
      const minutes = run?.uaBox?.correctiveTraining?.trim() && run.uaBox.minutes ? run.uaBox.minutes : null;
      const retrainedAt = minutes ? run?.endedAt ?? at : null;
      const linked = run?.uaBox?.sameIssueAs?.[group.category];
      if (group.added) {
        const task = (linked && taskOf.get(linked)) || `${group.category}.added:${group.id}`;
        taskOf.set(key, task);
        occurrences.push({ id: key, phase: report.phase, task, at, retrainedAt, retrainMinutes: minutes });
        continue;
      }
      for (const item of group.tasks) {
        const task = (linked && taskOf.get(linked)) || `${group.category}.${item.id.split(":").pop()}`;
        taskOf.set(key, taskOf.get(key) ?? task);
        occurrences.push({ id: `${key}|${item.id}`, phase: report.phase, task, at, retrainedAt, retrainMinutes: minutes });
      }
    }
  }
  return occurrences;
}
