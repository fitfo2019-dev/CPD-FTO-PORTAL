import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineStorage } from './offlineStorage.js';
import { createDailyReportDraft } from './daily-report-draft.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import {
  checkPacketService, continueSharedPacketHistory, createSharedPacketHistory, PacketHistoryCursorError,
  readSharedPackets, readSharedPacketsPage, uploadPacketBatch,
} from './training-packet-sync.js';

function sharedPacketFor(report: ReturnType<typeof createDailyReportDraft>) {
  return { id: report.id, assignment_id: '81dc3739-03c3-4cc1-bc9c-851bba10e833',
    record_date: report.date, phase: report.phase, server_version: 1,
    sync_status: 'synchronized_complete', report, content_hash: 'a'.repeat(64),
    released_to_po: false, released_at: null, withdrawn_at: null, withdrawal_reason: null,
    amendment_of: null, amendment_reason: null, acknowledgment: null };
}

function success(data: unknown, metadata: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ status: 'success', metadata: {
    has_more: false, next_cursor: null, ...metadata,
  }, data }), {
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

test('shared packet reads request bounded continuation pages and stop only at the real end', async t => {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-23');
  const nextReport = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, '2026-11-22');
  const packet = sharedPacketFor(report);
  const nextPacket = sharedPacketFor(nextReport);
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input); urls.push(url);
    return url.includes('?cursor=')
      ? success([nextPacket], { total_records: 2, role: 'FTO', has_more: false, next_cursor: null })
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

test('filtered packet history repeats the same filters on continuation requests', async t => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    urls.push(String(input));
    return success([], { total_records: 0, role: 'FTO', has_more: false, next_cursor: null });
  });
  await readSharedPacketsPage('stable-cursor', undefined, {
    recruit: 'Alex Rivera', dateFrom: '2026-11-01', dateTo: '2026-11-30',
  });
  assert.deepEqual(urls, [
    '/api/v1/training-packets?cursor=stable-cursor&recruit=Alex+Rivera&date_from=2026-11-01&date_to=2026-11-30',
  ]);
});

test('failed history pages resume one page at a time with the same filters', async t => {
  const workspace = createUiPreviewWorkspace();
  const first = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-23'));
  const second = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-22'));
  const urls: string[] = [];
  const methods: string[] = [];
  let laterPageAttempts = 0;
  const filters = { recruit: 'Alex Rivera', dateFrom: '2026-11-01', dateTo: '2026-11-30' };
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); urls.push(url);
    methods.push(init?.method ?? 'GET');
    assert.equal(init?.body, undefined);
    if (!url.includes('cursor=')) return success([first], {
      total_records: 2, role: 'FTO', has_more: true, next_cursor: 'page-two',
    });
    if (laterPageAttempts++ === 0) throw new TypeError('temporary network failure');
    return success([second], { total_records: 2, role: 'FTO', has_more: false, next_cursor: null });
  });

  const history = createSharedPacketHistory(filters);
  await continueSharedPacketHistory(history, undefined, undefined, 1);
  assert.deepEqual(history.data.map(packet => packet.id), [first.id]);
  assert.equal(history.nextCursor, 'page-two');
  await assert.rejects(continueSharedPacketHistory(history, undefined, undefined, 1), TypeError);
  assert.deepEqual(history.data.map(packet => packet.id), [first.id]);
  assert.equal(history.nextCursor, 'page-two');
  await continueSharedPacketHistory(history, undefined, undefined, 1);
  assert.deepEqual(history.data.map(packet => packet.id), [first.id, second.id]);
  assert.equal(history.complete, true);
  assert.deepEqual(methods, ['GET', 'GET', 'GET']);
  assert.deepEqual(urls, [
    '/api/v1/training-packets?recruit=Alex+Rivera&date_from=2026-11-01&date_to=2026-11-30',
    '/api/v1/training-packets?cursor=page-two&recruit=Alex+Rivera&date_from=2026-11-01&date_to=2026-11-30',
    '/api/v1/training-packets?cursor=page-two&recruit=Alex+Rivera&date_from=2026-11-01&date_to=2026-11-30',
  ]);
});

test('repeated cursors fail clearly without appending a repeated page', async t => {
  const workspace = createUiPreviewWorkspace();
  const first = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-23'));
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) =>
    String(input).includes('?cursor=')
      ? success([first], { total_records: 1, role: 'FTO', has_more: true, next_cursor: 'repeated-page' })
      : success([first], { total_records: 1, role: 'FTO', has_more: true, next_cursor: 'repeated-page' }));

  const history = createSharedPacketHistory();
  await assert.rejects(continueSharedPacketHistory(history), PacketHistoryCursorError);
  assert.deepEqual(history.data.map(packet => packet.id), [first.id]);
  assert.equal(history.nextCursor, 'repeated-page');
  assert.equal(history.blocked, true);
});

test('invalid cursors fail clearly and preserve the last confirmed page', async t => {
  const workspace = createUiPreviewWorkspace();
  const first = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-23'));
  const second = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-22'));
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) =>
    String(input).includes('?cursor=')
      ? success([second], { total_records: 2, role: 'FTO', has_more: true, next_cursor: '   ' })
      : success([first], { total_records: 2, role: 'FTO', has_more: true, next_cursor: 'page-two' }));

  const history = createSharedPacketHistory();
  await assert.rejects(continueSharedPacketHistory(history), PacketHistoryCursorError);
  assert.deepEqual(history.data.map(packet => packet.id), [first.id]);
  assert.equal(history.nextCursor, 'page-two');
  assert.equal(history.blocked, true);
});

test('oversized cursors fail as unsafe continuation metadata', async t => {
  const workspace = createUiPreviewWorkspace();
  const first = sharedPacketFor(createDailyReportDraft(workspace.caseFolder!, '2026-11-23'));
  t.mock.method(globalThis, 'fetch', async () =>
    success([first], { total_records: 1, role: 'FTO', has_more: true, next_cursor: 'c'.repeat(257) }));
  const history = createSharedPacketHistory();
  await assert.rejects(continueSharedPacketHistory(history), PacketHistoryCursorError);
  assert.equal(history.data.length, 0);
  assert.equal(history.blocked, true);
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
