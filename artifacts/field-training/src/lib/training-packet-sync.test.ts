import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineStorage } from './offlineStorage.js';
import { createDailyReportDraft } from './daily-report-draft.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import { checkPacketService, readSharedPackets, uploadPacketBatch } from './training-packet-sync.js';

function success(data: unknown, metadata: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ status: 'success', metadata, data }), {
    headers: { 'content-type': 'application/json' },
  });
}

test('a submitted sync retry seals only after a matching authenticated read, never from the receipt alone',async t=>{
  const report=createDailyReportDraft(createUiPreviewWorkspace().caseFolder!,'2026-11-23');
  const operation='29b09e69-073a-4b60-b7be-564945cf587e';
  let authoritativeStatus='local_draft_pending';
  const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{
    const url=String(input);calls.push(url);
    return url.endsWith('/sync')?success([{
      id:report.id,operation_id:operation,server_version:1,sync_status:'synchronized_complete',
    }],{total_records:1,role:'FTO'}):success([{
      id:report.id,assignment_id:'81dc3739-03c3-4cc1-bc9c-851bba10e833',record_date:report.date,
      phase:report.phase,server_version:1,sync_status:authoritativeStatus,report,content_hash:'a'.repeat(64),
      released_to_po:false,released_at:null,withdrawn_at:null,withdrawal_reason:null,
      amendment_of:null,amendment_reason:null,acknowledgment:null,
    }],{total_records:1,role:'FTO'});
  });
  const change={operationId:operation,recordId:report.id,baseVersion:0,value:report,attempted:true,
    clientTimestamp:'2026-11-23T14:00:00Z'};
  await assert.rejects(uploadPacketBatch([change]),/did not confirm an explicitly submitted packet/);
  authoritativeStatus='synchronized_complete';
  const [receipt]=await uploadPacketBatch([change]);
  assert.equal(receipt.sync_status,'synchronized_complete');
  assert.equal(receipt.submittedVerified,true);
  assert.equal(calls.length,4);
  assert.ok(calls.every(url=>!url.includes('/finalize')));
});

test('read helpers use bounded same-origin GETs and retain complete packet data', async t => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const packet = { id: report.id, assignment_id: '81dc3739-03c3-4cc1-bc9c-851bba10e833',
    record_date: report.date, phase: report.phase, server_version: 1,
    sync_status: 'synchronized_complete', report, content_hash: 'a'.repeat(64),
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
      ? success([{ automatic_sync_allowed: true }], { can_sync: true })
      : success([packet], { total_records: 1, role: 'FTO' });
  });
  assert.equal(await checkPacketService(), true);
  const records = await readSharedPackets();
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
  fetch.mock.mockImplementation(async () => success([], { can_sync: false }));
  assert.equal(await checkPacketService(), false);
});

test('local save never uploads; an uncertain draft upload retries its exact snapshot without submitting', async t => {
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
      sync_status: 'local_draft_pending',
    })), { total_records: payload.packets.length, role: 'FTO' });
  });
  await vault.saveWorkspace({ ...workspace, reports: [report] });
  assert.equal(calls.length, 0);
  await assert.rejects(vault.syncPacketBatch(changes => uploadPacketBatch(changes)));
  const guarded = await vault.get<{ reports: typeof report[] }>('workspace');
  assert.equal(guarded?.reports[0].syncAttemptPending, true);
  assert.notEqual(guarded?.reports[0].syncStatus, 'synchronized_complete');
  const synced = await vault.syncPacketBatch(changes => uploadPacketBatch(changes));
  assert.equal(synced?.reports[0].syncStatus, 'local_draft_pending');
  assert.equal(await vault.pendingCount(), 0);
  assert.deepEqual(calls, ['/api/v1/training-packets/sync', '/api/v1/training-packets/sync']);
  vault.lock();
});
