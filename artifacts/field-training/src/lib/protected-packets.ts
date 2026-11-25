import type { Report, Workspace } from "./model.js";

/** Transport state is not authored content and must not dirty an open editor. */
export function authoredReportSnapshot(report:Report|undefined):string {
  if(!report)return "null";
  const {syncStatus:_status,serverVersion:_version,serverContentHash:_hash,
    draftSyncPending:_pending,syncAttemptPending:_attempt,finalizationAttemptPending:_finalize,...authored}=report;
  return JSON.stringify(authored);
}

/** Apply receipts to the latest workspace, not the workspace captured by a request.
 * Mounted editors keep their own unsaved form state; callers must not remount them. */
export function applyPacketSyncState(current:Workspace,stored:Workspace):Workspace {
  const saved=new Map(stored.reports.map(report=>[report.id,report]));
  return {...current,reports:current.reports.map(report=>{
    const next=saved.get(report.id);
    if(!next||(next.serverVersion??0)<(report.serverVersion??0))return report;
    const unchanged=authoredReportSnapshot(report)===authoredReportSnapshot(next);
    return {...report,syncStatus:next.syncStatus,serverVersion:next.serverVersion,
      serverContentHash:unchanged?next.serverContentHash:undefined,
      draftSyncPending:unchanged?next.draftSyncPending:true,
      syncAttemptPending:next.syncAttemptPending,
      finalizationAttemptPending:next.finalizationAttemptPending};
  })};
}

/** State-wide reconciliation must not normalize or remove a packet whose
 * server outcome is unresolved, or one already sealed by a server receipt. */
export function preserveProtectedPackets(previous: Workspace, next: Workspace): Workspace {
  const protectedReports = previous.reports.filter(report =>
    report.syncAttemptPending || report.finalizationAttemptPending ||
    report.syncStatus === "submitted_complete" || report.syncStatus === "synchronized_complete");
  if (!protectedReports.length) return next;
  const protectedById = new Map(protectedReports.map(report => [report.id, report]));
  const nextIds = new Set(next.reports.map(report => report.id));
  return { ...next, reports: [
    ...next.reports.map(report => protectedById.get(report.id) ?? report),
    ...protectedReports.filter(report => !nextIds.has(report.id)),
  ] };
}
