import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyReportDraft } from './daily-report-draft.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import { packetUploadBlock, queuedReports } from './packet-upload-controls.js';

test('packet controls require saved, online, unlocked, explicitly checked FTO state', () => {
  const allowed = { previewOnly: false, unlocked: true, online: true, busy: false, unsaved: false,
    serviceReady: true, ftoView: true, count: 1, savedCount: 1 };
  assert.equal(packetUploadBlock(allowed), null);
  for (const blocked of [
    { previewOnly: true }, { unlocked: false }, { online: false }, { busy: true },
    { unsaved: true }, { serviceReady: false }, { ftoView: false }, { count: 0 },
    { count: 101, savedCount: 101 }, { savedCount: 2 },
  ]) assert.ok(packetUploadBlock({ ...allowed, ...blocked }));
});

test('queue includes legacy drafts and unconfirmed retries, never confirmed seals', () => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const reports = [report, { ...report, id: 'retry', syncAttemptPending: true },
    { ...report, id: 'sealed', syncStatus: 'synchronized_complete' as const, serverVersion: 1 }];
  assert.deepEqual(queuedReports(reports).map(item => item.id), [report.id, 'retry']);
});
