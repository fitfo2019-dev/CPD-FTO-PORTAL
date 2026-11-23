import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { OfflineStorage } from './offlineStorage.js';
import { WorkspaceProvider, useWorkspace } from '../state/workspace.js';

const encoder = new TextEncoder();
const passphrase = encoder.encode('local-test-passphrase');

function createVault() {
  const namespace = `offline-test-${crypto.randomUUID()}`;
  return { namespace, vault: new OfflineStorage(namespace) };
}

test('offline vault restores encrypted records and rejects a wrong passphrase', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  await vault.save('workspace', { note: 'saved on this device' });
  assert.equal(await vault.pendingCount(), 1);
  vault.lock();

  const restored = new OfflineStorage(namespace);
  await assert.rejects(restored.unlock(encoder.encode('wrong-passphrase')));
  assert.equal(restored.isUnlocked, false);
  await restored.unlock(passphrase);
  assert.deepEqual(await restored.get('workspace'), { note: 'saved on this device' });
});

test('workspace save queues only latest complete packets, never roster or whole workspace', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  const workspace = { reports: [{ id: 'p1', syncStatus: 'local_draft_pending', narrative: 'first' }],
    assignments: [{ badge: 'do-not-upload' }], role: 'role-preview' };
  await vault.save('workspace', workspace); // legacy whole-workspace queue
  await vault.saveWorkspace(workspace);
  await vault.saveWorkspace({ ...workspace, reports: [{ ...workspace.reports[0], narrative: 'latest' }] });
  assert.equal(await vault.pendingCount(), 1);
  const next = await vault.syncPacketBatch(async changes => {
    assert.equal(changes.length, 1);
    assert.equal(changes[0].recordId, 'p1');
    assert.deepEqual(changes[0].value, { ...workspace.reports[0], narrative: 'latest' });
    return changes.map(change => ({ id: change.recordId, operation_id: change.operationId,
      server_version: 1, sync_status: 'synchronized_complete' }));
  });
  assert.equal(next?.reports[0].syncStatus, 'synchronized_complete');
  assert.equal(await vault.pendingCount(), 0);
  // A delayed pre-acknowledgement autosave cannot erase the seal.
  await vault.saveWorkspace(workspace);
  assert.equal((await vault.get<typeof workspace>('workspace'))?.reports[0].syncStatus, 'synchronized_complete');
  assert.equal(await vault.pendingCount(), 0);
});

test('failed and partial packet acknowledgements retain encrypted drafts and retry operation IDs', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  const workspace = { reports: [{ id: 'p1', syncStatus: 'local_draft_pending' }] };
  await vault.saveWorkspace(workspace);
  let firstOperation: string | undefined;
  await assert.rejects(vault.syncPacketBatch(async changes => {
    firstOperation = changes[0].operationId;
    throw new Error('network lost');
  }), /network lost/);
  await vault.saveWorkspace(workspace);
  await assert.rejects(vault.syncPacketBatch(async changes => {
    assert.equal(changes[0].operationId, firstOperation);
    return [];
  }), /Invalid packet/);
  assert.equal(await vault.pendingCount(), 1);
  assert.equal((await vault.get<typeof workspace>('workspace'))?.reports[0].syncStatus, 'local_draft_pending');
});

test('locking the vault during packet transmission cannot restore plaintext or acknowledge queued data', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  await vault.saveWorkspace({ reports: [{ id: 'p1' }] });
  await assert.rejects(vault.syncPacketBatch(async changes => {
    vault.lock();
    return changes.map(change => ({ id: change.recordId, operation_id: change.operationId,
      server_version: 1, sync_status: 'synchronized_complete' }));
  }), /expired/);
  await vault.unlock(passphrase);
  assert.equal(await vault.pendingCount(), 1);
});

test('a lost response after server commit can be reconciled after vault reopening without replacing the operation or snapshot', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  const workspace = { reports: [{ id: 'p1', syncStatus: 'local_draft_pending',
    narrative: 'Exact originally committed snapshot' }] };
  await vault.saveWorkspace(workspace);
  let committed: { operationId: string; serialized: string } | undefined;
  await assert.rejects(vault.syncPacketBatch(async changes => {
    committed = { operationId: changes[0].operationId, serialized: JSON.stringify(changes[0].value) };
    // Simulate successful server COMMIT followed by a lost HTTP response.
    throw new Error('response lost after commit');
  }), /response lost/);
  vault.lock();
  const reopened = new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  type Restored = { reports: Array<{ id: string; narrative: string; syncStatus: string;
    syncAttemptPending?: boolean; legacyActivity?: Record<string, unknown> }> };
  const restored = await reopened.get<Restored>('workspace');
  assert.ok(restored);
  // Workspace restoration uses this guard to bypass report normalization.
  assert.equal(restored.reports[0].syncAttemptPending, true);
  // A stray migration/autosave cannot replace an uncertain operation.
  await assert.rejects(reopened.saveWorkspace({
    ...restored, reports: [{ ...restored.reports[0], legacyActivity: {} }],
  }), /Reconcile the attempted/);
  await reopened.saveWorkspace(restored);
  const acknowledged = await reopened.syncPacketBatch(async changes => {
    assert.equal(changes[0].operationId, committed?.operationId);
    assert.equal(JSON.stringify(changes[0].value), committed?.serialized);
    // The server recognizes the already-committed operation and returns its receipt.
    return [{ id: 'p1', operation_id: changes[0].operationId,
      server_version: 1, sync_status: 'synchronized_complete' }];
  });
  assert.equal(acknowledged?.reports[0].syncStatus, 'synchronized_complete');
  assert.equal(acknowledged?.reports[0].syncAttemptPending, false);
  assert.equal(await reopened.pendingCount(), 0);
});

test('upgrading an existing vault adds the local-drafts store without dropping records', async () => {
  const namespace = `offline-upgrade-${crypto.randomUUID()}`;
  const databaseName = `fieldready-vault-${namespace}`;
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1);
    open.onupgradeneeded = () => {
      for (const name of ['records', 'sync_queue', 'meta']) {
        open.result.createObjectStore(name, { keyPath: 'id' });
      }
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').put({ id: 'legacy-record', value: 'keep this' });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });

  const vault = new OfflineStorage(namespace);
  await vault.unlock(passphrase);
  const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(databaseName, 2);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  assert.equal(upgraded.objectStoreNames.contains('local_drafts'), true);
  const retained = await new Promise((resolve, reject) => {
    const request = upgraded.transaction('records').objectStore('records').get('legacy-record');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.deepEqual(retained, { id: 'legacy-record', value: 'keep this' });
  upgraded.close();
  vault.lock();
});

test('local queue survives transport errors and is removed only after a matching acknowledgement', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  await vault.save('report-1', { narrative: 'offline draft' }, 0);

  await assert.rejects(vault.sync(async () => { throw new Error('network unavailable'); }), /network unavailable/);
  assert.equal(await vault.pendingCount(), 1);

  const result = await vault.sync(async change => ({
    status: 'accepted',
    operationId: change.operationId,
    version: change.baseVersion + 1,
  }));
  assert.deepEqual(result, { sent: 1, conflicts: [] });
  assert.equal(await vault.pendingCount(), 0);
});

test('offline chat drafts stay encrypted, unsent, and deletable outside the sync queue', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  const draft = { id: 'draft-1', sender: 'FTO · local draft', body: 'Keep this on this device', createdAt: new Date().toISOString() };
  await vault.saveLocalOnlyDraft('chat-draft:draft-1', draft);
  assert.equal(await vault.pendingCount(), 0);
  vault.lock();

  const restored = new OfflineStorage(namespace);
  await restored.unlock(passphrase);
  assert.deepEqual(await restored.getLocalOnlyDrafts(), [draft]);
  let transportCalls = 0;
  const syncResult = await restored.sync(async () => {
    transportCalls++;
    throw new Error('A local chat draft must not be uploaded.');
  });
  assert.deepEqual(syncResult, { sent: 0, conflicts: [] });
  assert.equal(transportCalls, 0);

  await restored.deleteLocalOnlyDraft('chat-draft:draft-1');
  assert.deepEqual(await restored.getLocalOnlyDrafts(), []);
  assert.equal(await restored.pendingCount(), 0);
});

test('version conflicts keep both the local record and queued operation', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  const local = { narrative: 'local version' };
  await vault.save('report-conflict', local, 4);

  const result = await vault.sync(async () => ({ status: 'conflict', serverVersion: 5 }));
  assert.deepEqual(result, { sent: 0, conflicts: ['report-conflict'] });
  assert.equal(await vault.pendingCount(), 1);
  assert.deepEqual(await vault.get('report-conflict'), local);
});

test('concurrent local saves serialize and preserve the final record', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  await Promise.all([
    vault.save('workspace', { latest: 'first completed write' }),
    vault.save('workspace', { latest: 'second completed write' }),
  ]);
  assert.deepEqual(await vault.get('workspace'), { latest: 'second completed write' });
  assert.equal(await vault.pendingCount(), 2);
});

test('a save interrupted by locking leaves the prior committed record and queue intact', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  await vault.save('workspace', { note: 'committed before interruption' });

  const interruptedSave = vault.save('workspace', { note: 'must not partially commit' });
  vault.lock();
  await assert.rejects(interruptedSave, /Vault session expired/);

  const restored = new OfflineStorage(namespace);
  await restored.unlock(passphrase);
  assert.deepEqual(await restored.get('workspace'), { note: 'committed before interruption' });
  assert.equal(await restored.pendingCount(), 1);
});

test('locking clears access to the unlocked key', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  await vault.save('workspace', { note: 'protected locally' });
  vault.lock();
  assert.equal(vault.isUnlocked, false);
  await assert.rejects(vault.get('workspace'), /Unlock the local vault/);
});

test('preview edits, autosave, sync, and reset never create device storage records', async () => {
  const namespace = `preview-only-${crypto.randomUUID()}`;
  const databaseName = `fieldready-vault-${namespace}`;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globalKeys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const testGlobals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(testGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  let current: ReturnType<typeof useWorkspace> | undefined;
  function Probe() {
    current = useWorkspace();
    return null;
  }

  const container = dom.window.document.getElementById('root')!;
  let root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(WorkspaceProvider, { storageNamespace: namespace, previewOnly: true },
        createElement(Probe)));
    });
    assert.ok(current);
    assert.equal(current.dirty, false);

    await assert.rejects(current!.setupAndSave('preview-must-not-persist'), /memory-only/);
    await assert.rejects(current!.unlockAndRestore('preview-must-not-restore'), /memory-only/);
    assert.equal(current!.pending, 0);
    assert.deepEqual(await indexedDB.databases().then(databases =>
      databases.filter(database => database.name === databaseName)), []);

    await act(async () => {
      current!.setCaseFolder({ ...current!.ws.caseFolder!, recruitName: 'PREVIEW EDIT ONLY' });
      await current!.saveNow();
    });
    assert.equal(current!.ws.caseFolder?.recruitName, 'PREVIEW EDIT ONLY');

    await act(async () => {
      await current!.submitPhaseExtensionRequest({
        id: 'preview-extension',
        className: 'UI TEST ONLY',
        recruitName: 'PREVIEW EDIT ONLY',
        recruitBadge: 'DEMO-PO',
        phase: 3,
        phaseStartDate: '2026-11-16',
        requestingFtoName: 'DEMO FTO',
        requestingFtoBadge: 'DEMO-FTO',
        extensionType: 'training_weeks',
        requestedWeeks: 1,
        justification: 'Preview-only test request',
        createdAt: new Date().toISOString(),
      });
      await current!.saveLocalChatDraft({
        id: 'preview-chat',
        sender: 'Preview user',
        body: 'Memory only',
        createdAt: new Date().toISOString(),
      });
    });
    assert.equal(current!.ws.phaseExtensionRequests[0]?.id, 'preview-extension');
    assert.equal(current!.dirty, true);
    assert.equal((await current!.loadLocalChatDrafts()).length, 1);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 850));
    });
    await act(async () => { await current!.syncPackets(); });
    assert.deepEqual(await indexedDB.databases().then(databases =>
      databases.filter(database => database.name === databaseName)), []);

    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkspaceProvider, { storageNamespace: namespace, previewOnly: true },
        createElement(Probe)));
    });
    assert.ok(current);
    assert.equal(current!.ws.caseFolder?.recruitName, 'DEMO PO');
    assert.equal(current!.ws.phaseExtensionRequests.some(request =>
      request.id === 'preview-extension'), false);
    assert.equal(current!.dirty, false);
    assert.deepEqual(await current!.loadLocalChatDrafts(), []);
    assert.deepEqual(await indexedDB.databases().then(databases =>
      databases.filter(database => database.name === databaseName)), []);

    const previousEpoch = current!.epoch;
    await act(async () => { current!.resetWorkspace(); });
    assert.ok(current!.epoch > previousEpoch);
    assert.equal(current!.ws.caseFolder?.recruitName, 'DEMO PO');
    assert.equal(current!.dirty, false);
    assert.deepEqual(await current!.loadLocalChatDrafts(), []);

    await act(async () => { await current!.syncPackets(); });
    assert.deepEqual(await indexedDB.databases().then(databases =>
      databases.filter(database => database.name === databaseName)), []);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});
