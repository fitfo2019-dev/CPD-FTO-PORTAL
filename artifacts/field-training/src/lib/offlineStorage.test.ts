import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineStorage } from './offlineStorage';

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
