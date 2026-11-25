import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyReportDraft } from './daily-report-draft.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import { packetDraftSyncBlock, packetFinalizationBlock, queuedReports } from './packet-upload-controls.js';

test('draft sync controls require saved, online, unlocked, service-checked FTO state', () => {
  const allowed = { previewOnly: false, unlocked: true, online: true, busy: false, unsaved: false,
    serviceReady: true, ftoView: true, count: 1, savedCount: 1 };
  assert.equal(packetDraftSyncBlock(allowed), null);
  for (const blocked of [
    { previewOnly: true }, { unlocked: false }, { online: false }, { busy: true },
    { unsaved: true }, { serviceReady: false }, { ftoView: false }, { count: 0 },
    { count: 101, savedCount: 101 }, { savedCount: 2 },
  ]) assert.ok(packetDraftSyncBlock({ ...allowed, ...blocked }));
});

test('draft queue excludes synchronized drafts and submitted seals, but preserves uncertain retries', () => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const reports = [report, { ...report, id: 'retry', syncAttemptPending: true },
    { ...report, id: 'agency-draft', draftSyncPending: false, serverVersion: 1, serverContentHash: 'a'.repeat(64) },
    { ...report, id: 'sealed', syncStatus: 'submitted_complete' as const, serverVersion: 1 },
    { ...report, id: 'legacy-sealed', syncStatus: 'synchronized_complete' as const, serverVersion: 1 }];
  assert.deepEqual(queuedReports(reports).map(item => item.id), [report.id, 'retry']);
});

test('finalization stays separate and requires a current server-synced snapshot', () => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const ready = { ...report, draftSyncPending: false, serverVersion: 1, serverContentHash: 'b'.repeat(64) };
  const allowed = { previewOnly: false, unlocked: true, online: true, busy: false,
    unsaved: false, serviceReady: true, ftoView: true };
  assert.equal(packetFinalizationBlock(ready, allowed), null);
  assert.equal(packetFinalizationBlock({ ...ready, finalizationAttemptPending: true }, allowed), null,
    'an uncertain finalize must allow the exact saved retry');
  assert.match(packetFinalizationBlock(report, allowed) ?? '', /Synchronize and Save/);
  assert.match(packetFinalizationBlock(ready, { ...allowed, serviceReady: false }) ?? '', /Check Agency Access/);
  assert.match(packetFinalizationBlock(ready, { ...allowed, ftoView: false }) ?? '', /Assigned, Server-Verified FTO/);
  assert.match(packetFinalizationBlock(ready, { ...allowed, previewOnly: true }) ?? '', /Preview Only/);
  assert.match(packetFinalizationBlock({ ...ready, syncAttemptPending: true }, allowed) ?? '', /Draft Sync Is Unconfirmed/);
  assert.match(packetFinalizationBlock({ ...ready, syncStatus: 'submitted_complete' }, allowed) ?? '', /already been submitted/);
});
