import type { Workspace } from "./model.js";

/** State-wide reconciliation must not normalize or remove a packet whose
 * server outcome is unresolved, or one already sealed by a server receipt. */
export function preserveProtectedPackets(previous: Workspace, next: Workspace): Workspace {
  const protectedReports = previous.reports.filter(report =>
    report.syncAttemptPending || report.syncStatus === "synchronized_complete");
  if (!protectedReports.length) return next;
  const protectedById = new Map(protectedReports.map(report => [report.id, report]));
  const nextIds = new Set(next.reports.map(report => report.id));
  return { ...next, reports: [
    ...next.reports.map(report => protectedById.get(report.id) ?? report),
    ...protectedReports.filter(report => !nextIds.has(report.id)),
  ] };
}
