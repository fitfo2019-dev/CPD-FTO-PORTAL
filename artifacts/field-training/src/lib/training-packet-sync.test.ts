import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineStorage } from './offlineStorage.js';
import { createDailyReportDraft } from './daily-report-draft.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import { checkPacketService, finalizePacket, readSharedPackets, readSharedPacketsPage, uploadPacketBatch } from './training-packet-sync.js';

function success(data: unknown, metadata: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ status: 'success', metadata, data }), {
    headers: { 'content-type': 'application/json' },
  });
}
test('draft sync rejects a submitted receipt and never finalizes the packet',async t=>{
  const report=createDailyReportDraft(createUiPreviewWorkspace().caseFolder!,'2026-11-23');
  const operation='29b09e69-073a-4b60-b7be-564945cf587e';
  const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{
    const url=String(input);calls.push(url);
    return success([{
      id:report.id,operation_id:operation,server_version:1,
      sync_status:'submitted_complete',content_hash:'a'.repeat(64),
    }],{total_records:1,role:'FTO'});
  });
  const change={operationId:operation,recordId:report.id,baseVersion:0,value:report,attempted:true,
    clientTimestamp:'2026-11-23T14:00:00Z'};
  await assert.rejects(uploadPacketBatch([change]));
  assert.deepEqual(calls,['/api/v1/training-packets/sync']);
  assert.ok(calls.every(url=>!url.includes('/finalize')));
});
test('shared packet reads request bounded continuation pages and stop only at the real end', async t => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const packet = { id: report.id, assignment_id: '81dc3739-03c3-4cc1-bc9c-851bba10e833',
    record_date: report.date, phase: report.phase, server_version: 1,
    sync_status: 'submitted_complete', handoff_status: 'draft', po_totals: null, report, content_hash: 'a'.repeat(64),
    released_to_po: false, released_at: null, withdrawn_at: null, withdrawal_reason: null,
    amendment_of: null, amendment_reason: null, acknowledgment: null };
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input); urls.push(url);
    return url.includes('?cursor=')
      ? success([packet], { total_records: 1, role: 'FTO', has_more: false, next_cursor: null })
      : success([packet], { total_records: 1, role: 'FTO', has_more: true, next_cursor: 'next-page-cursor' });
  });
  const first = await readSharedPacketsPage();
  assert.equal(first.hasMore, true);
  assert.equal(first.nextCursor, 'next-page-cursor');
  const records = await readSharedPackets();
  assert.equal(records.length, 2);
  assert.equal(urls.filter(url => url === '/api/v1/training-packets').length, 2);
  assert.ok(urls.includes('/api/v1/training-packets?cursor=next-page-cursor'));
});

test('read helpers use bounded same-origin GETs and retain complete packet data', async t => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const packet = { id: report.id, assignment_id: '81dc3739-03c3-4cc1-bc9c-851bba10e833',
    record_date: report.date, phase: report.phase, server_version: 1,
    sync_status: 'submitted_complete', handoff_status: 'draft', po_totals: null, report, content_hash: 'a'.repeat(64),
    released_to_po: false, released_at: null, withdrawn_at: null, withdrawal_reason: null,
    amendment_of: null, amendment_reason: null, acknowledgment: null };
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(String(input));
    assert.equal(init?.credentials, 'same-origin');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    assert.equal(init?.body, undefined);
    return String(input).endsWith('sync-readiness')
      ? success([{ automatic_sync_allowed: false }], { can_sync: true })
      : success([packet], { total_records: 1, role: 'FTO', has_more:false,next_cursor:null });
  });
  assert.equal(await checkPacketService(), true);
  const records = await readSharedPackets();
  assert.ok(records[0].report);
  assert.equal(records[0].report.shift, report.shift);
  assert.deepEqual(records[0].report.signatures, report.signatures);
  assert.equal(records[0].report.id, report.id);
  assert.deepEqual(urls, ['/api/v1/training-packets/sync-readiness', '/api/v1/training-packets']);
});

test('reads fail explicitly for unavailable access or malformed envelopes', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ status: 'error', error_code: 'AGENCY_IDENTITY_REQUIRED', message: 'Denied' }),
      { status: 403, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(readSharedPackets());
  await assert.rejects(checkPacketService());
  fetch.mock.mockImplementation(async () => success([{ missing: 'packet fields' }], { total_records: 1, role: 'FTO' }));
  await assert.rejects(readSharedPackets());
  fetch.mock.mockImplementation(async () => success([{ automatic_sync_allowed: false }], { can_sync: false }));
  assert.equal(await checkPacketService(), false);
});

test('finalization uses the separate authenticated route and verifies its submitted receipt', async t => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  let requestUrl = '';
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      operation_id: 'd6b1ed28-4e73-47b9-8138-455e6932e6cb',
      base_version: 3, content_hash: 'c'.repeat(64),
    });
    return new Response(JSON.stringify({
      id: report.id, operation_id: 'd6b1ed28-4e73-47b9-8138-455e6932e6cb',
      server_version: 3, sync_status: 'submitted_complete', content_hash: 'c'.repeat(64),
    }), { headers: { 'content-type': 'application/json' } });
  });
  const receipt = await finalizePacket(report.id, 'd6b1ed28-4e73-47b9-8138-455e6932e6cb', 'c'.repeat(64), 3);
  assert.deepEqual(receipt, { id: report.id, operation_id: 'd6b1ed28-4e73-47b9-8138-455e6932e6cb', server_version: 3,
    sync_status: 'submitted_complete', content_hash: 'c'.repeat(64) });
  assert.equal(requestUrl, `/api/v1/training-packets/${encodeURIComponent(report.id)}/finalize`);
});

test('authorized amendment metadata survives the encrypted draft sync transport', async t => {
  const vault = new OfflineStorage(`packet-amendment-${crypto.randomUUID()}`);
  await vault.unlock(new TextEncoder().encode('fictional-amendment-test-passphrase'));
  await vault.saveWorkspace({ reports: [{
    id: 'amendment-packet', date: '2026-11-23', phase: 2, className: 'FICTIONAL',
    recruitBadge: 'TEST-PO', ftoBadge: 'TEST-FTO', amendmentOf: 'original-packet',
    amendmentReason: 'Corrected fictional record', narrative: 'Replacement snapshot',
  }] });
  let body = '';
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    body = String(init?.body);
    const payload = JSON.parse(body);
    return success(payload.packets.map((packet: { operation_id: string; report: { id: string } }) => ({
      id: packet.report.id, operation_id: packet.operation_id, server_version: 1,
      sync_status: 'local_draft_pending', content_hash: 'd'.repeat(64),
    })), { total_records: payload.packets.length, role: 'FTO' });
  });
  await vault.syncPacketBatch(changes => uploadPacketBatch(changes));
  const payload = JSON.parse(body);
  assert.equal(payload.packets[0].amendment_of, 'original-packet');
  assert.equal(payload.packets[0].amendment_reason, 'Corrected fictional record');
  vault.lock();
});

test('local save never uploads; draft retries preserve the exact snapshot without sealing', async t => {
  const vault = new OfflineStorage(`packet-controls-${crypto.randomUUID()}`);
  await vault.unlock(new TextEncoder().encode('fictional-packet-controls-test-passphrase'));
  const workspace = createUiPreviewWorkspace();
  const report = createDailyReportDraft(workspace.caseFolder!, '2026-11-23');
  const calls: string[] = [];
  let attempts = 0;
  let originalBody = '';
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(String(input));
    const body = String(init?.body);
    if (attempts++ === 0) {
      originalBody = body;
      throw new TypeError('Simulated lost response after possible commit');
    }
    assert.equal(body, originalBody);
    const payload = JSON.parse(body);
    assert.deepEqual(Object.keys(payload), ['packets']);
    assert.equal(payload.packets[0].report.id, report.id);
    return success(payload.packets.map((packet: { operation_id: string; report: { id: string } }) => ({
      id: packet.report.id, operation_id: packet.operation_id, server_version: 1,
      sync_status: 'local_draft_pending', content_hash: 'a'.repeat(64),
    })), { total_records: payload.packets.length, role: 'FTO' });
  });
  await vault.saveWorkspace({ ...workspace, reports: [report] });
  assert.equal(calls.length, 0);
  await assert.rejects(vault.syncPacketBatch(changes => uploadPacketBatch(changes)));
  const guarded = await vault.get<{ reports: typeof report[] }>('workspace');
  assert.equal(guarded?.reports[0].syncAttemptPending, true);
  assert.notEqual(guarded?.reports[0].syncStatus, 'submitted_complete');
  const synced = await vault.syncPacketBatch(changes => uploadPacketBatch(changes));
  assert.equal(synced?.reports[0].syncStatus, 'local_draft_pending');
  assert.equal(synced?.reports[0].serverContentHash, 'a'.repeat(64));
  assert.equal(await vault.pendingCount(), 0);
  assert.deepEqual(calls, ['/api/v1/training-packets/sync', '/api/v1/training-packets/sync']);
  vault.lock();
});

test('explicit finalization retries the saved idempotency key and seals only after server confirmation', async () => {
  const vault = new OfflineStorage(`packet-finalize-${crypto.randomUUID()}`);
  await vault.unlock(new TextEncoder().encode('fictional-finalization-test-passphrase'));
  const report = { id: 'packet-1', syncStatus: 'local_draft_pending', serverVersion: 2,
    serverContentHash: 'b'.repeat(64), draftSyncPending: false, narrative: 'Exact finalized snapshot' };
  await vault.saveWorkspace({ reports: [report] });
  let firstOperation: string | undefined;
  await assert.rejects(vault.finalizePacket('packet-1', async (_id, operationId) => {
    firstOperation = operationId;
    throw new Error('response lost after commit');
  }), /response lost/);
  const guarded = await vault.get<{ reports: Array<typeof report & { finalizationAttemptPending?: boolean }> }>('workspace');
  assert.equal(guarded?.reports[0].finalizationAttemptPending, true);
  await assert.rejects(vault.saveWorkspace({ reports: [{ ...report, narrative: 'changed after attempt' }] }),
    /attempted packet finalization/);
  const finalized = await vault.finalizePacket('packet-1', async (id, operationId, contentHash) => {
    assert.equal(id, 'packet-1');
    assert.equal(operationId, firstOperation);
    assert.equal(contentHash, report.serverContentHash);
    return { id, server_version: 2, sync_status: 'submitted_complete', content_hash: contentHash };
  });
  assert.equal(finalized?.reports[0].syncStatus, 'submitted_complete');
  assert.equal(finalized?.reports[0].finalizationAttemptPending, false);
  assert.equal(await vault.pendingCount(), 0);
  await vault.saveWorkspace({ reports: [{ ...report, narrative: 'later edit' }] });
  const sealed = await vault.get<{ reports: Array<typeof report> }>('workspace');
  assert.equal(sealed?.reports[0].syncStatus, 'submitted_complete');
  assert.equal(sealed?.reports[0].narrative, 'Exact finalized snapshot');
  vault.lock();
});
