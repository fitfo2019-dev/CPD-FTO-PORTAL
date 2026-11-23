import type { Report } from './model.js';

export function queuedReports(reports: Report[]): Report[] {
  return reports.filter(report => report.syncStatus !== 'synchronized_complete');
}

/** UI affordance only. The API is always the authorization boundary. */
export function packetUploadBlock(options: {
  previewOnly: boolean; unlocked: boolean; online: boolean; busy: boolean;
  unsaved: boolean; serviceReady: boolean; ftoView: boolean; count: number; savedCount: number;
}): string | null {
  if (options.previewOnly) return 'UI Preview Only. Packet Uploads and Agency Reads Are Disabled.';
  if (!options.unlocked) return 'Unlock Saved Work Before Uploading.';
  if (options.busy) return 'An Operation Is in Progress.';
  if (options.unsaved) return 'Save Open Edits Locally Before Uploading.';
  if (!options.online) return 'Offline. Save Locally, Then Choose Upload After Reconnecting.';
  if (!options.ftoView) return 'Only the Assigned, Server-Verified FTO May Upload.';
  if (!options.serviceReady) return 'Check Agency Access Before Uploading. The Server Must Verify Your Identity and Assignment.';
  if (!options.count) return 'No Packets Are Waiting to Upload.';
  if (options.count > 100) return 'The Queue Exceeds the 100-Packet Batch Limit. No Upload Was Started.';
  if (options.count !== options.savedCount) return 'Save Locally to Reconcile the Saved Packet Queue Before Uploading.';
  return null;
}
