import type { Report } from './model.js';

export function queuedReports(reports: Report[]): Report[] {
  return reports.filter(report => report.syncStatus !== 'submitted_complete' &&
    report.syncStatus !== 'synchronized_complete' &&
    (report.draftSyncPending !== false || report.syncAttemptPending === true));
}

/** UI affordance only. The API is always the authorization boundary. */
export function packetDraftSyncBlock(options: {
  previewOnly: boolean; unlocked: boolean; online: boolean; busy: boolean;
  unsaved: boolean; serviceReady: boolean; ftoView: boolean; count: number; savedCount: number;
}): string | null {
  if (options.previewOnly) return 'UI Preview Only. Draft Sync and Agency Reads Are Disabled.';
  if (!options.unlocked) return 'Unlock Saved Work Before Synchronizing Drafts.';
  if (options.busy) return 'An Operation Is in Progress.';
  if (options.unsaved) return 'Save Open Edits Locally Before Synchronizing Drafts.';
  if (!options.online) return 'Offline. Drafts Stay on This Device Until You Reconnect.';
  if (!options.ftoView) return 'Only the Assigned, Server-Verified FTO May Synchronize Drafts.';
  if (!options.serviceReady) return 'Check Agency Access Before Draft Sync. The Server Verifies Your Identity and Assignment.';
  if (!options.count) return 'No Local Drafts Are Waiting to Synchronize.';
  if (options.count > 100) return 'The Draft Queue Exceeds the 100-Packet Batch Limit. No Sync Was Started.';
  if (options.count !== options.savedCount) return 'Save Locally to Reconcile the Encrypted Draft Queue Before Sync.';
  return null;
}

export function packetFinalizationBlock(report: Report, options: {
  previewOnly: boolean; unlocked: boolean; online: boolean; busy: boolean;
  unsaved: boolean; serviceReady: boolean; ftoView: boolean;
}): string | null {
  if (report.syncStatus === 'submitted_complete' || report.syncStatus === 'synchronized_complete')
    return 'This packet has already been submitted and sealed.';
  if (options.previewOnly) return 'UI Preview Only. Finalization Is Disabled.';
  if (!options.unlocked) return 'Unlock Saved Work Before Finalization.';
  if (options.busy) return 'An Operation Is in Progress.';
  if (options.unsaved) return 'Save Open Edits Locally Before Finalization.';
  if (!options.online) return 'Offline. Keep Editing Locally and Finalize After Reconnecting.';
  if (!options.ftoView) return 'Only the Assigned, Server-Verified FTO May Finalize This Packet.';
  if (!options.serviceReady) return 'Check Agency Access Before Finalization.';
  if (report.syncAttemptPending) return 'Draft Sync Is Unconfirmed. Retry the Exact Draft Before Finalization.';
  if (report.draftSyncPending || !report.serverVersion || !report.serverContentHash)
    return 'Synchronize and Save This Draft Before Finalization.';
  if (report.finalizationAttemptPending) return null;
  return null;
}
