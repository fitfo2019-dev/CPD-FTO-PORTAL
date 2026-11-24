import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { OfflineStorage, WorkspaceConflictError } from './offlineStorage.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';
import {
  emptyDailyActivitySummary,
  emptyRatings,
  emptyReportingForDutyRecord,
  type Report,
} from './model.js';
import { WorkspaceProvider, useWorkspace } from '../state/workspace.js';

const encoder = new TextEncoder();
const passphrase = encoder.encode('local-test-passphrase');

function createVault() {
  const namespace = `offline-test-${crypto.randomUUID()}`;
  return { namespace, vault: new OfflineStorage(namespace) };
}

test('draft synchronization acknowledges storage without sealing and queues only subsequent edits',async()=>{
  const {namespace,vault}=createVault();
  await vault.unlock(passphrase);
  const report={id:'TEST-draft',syncStatus:'local_draft_pending',serverVersion:0,narrative:'first draft'};
  await vault.saveWorkspace({reports:[report]});
  const next=await vault.syncPacketBatch<{reports:typeof report[]}>(async changes=>changes.map(change=>({
    id:change.recordId,operation_id:change.operationId,server_version:1,sync_status:'local_draft_pending',content_hash:'a'.repeat(64),
  })));
  assert.equal(next?.reports[0].syncStatus,'local_draft_pending');
  assert.equal(next?.reports[0].serverVersion,1);
  assert.equal(await vault.pendingCount(),0);
  await vault.saveWorkspace(next!);
  assert.equal(await vault.pendingCount(),0);
  const changed={reports:[{...next!.reports[0],narrative:'edited after sync'}]};
  await vault.saveWorkspace(changed);
  assert.equal(await vault.pendingCount(),1);
  const updated=await vault.syncPacketBatch<typeof changed>(async changes=>{
    assert.equal(changes[0].baseVersion,1);
    return changes.map(change=>({id:change.recordId,operation_id:change.operationId,server_version:2,sync_status:'local_draft_pending',content_hash:'b'.repeat(64)}));
  });
  vault.lock();
  const reopened=new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  assert.deepEqual(await reopened.get('workspace'),updated);
  reopened.lock();
});

test('explicit arrest classifications survive encrypted save, reopen, and repeated edits with legacy charge details intact',async()=>{
  type TestRun={id:string;charges?:unknown;generatedDocuments?:Array<{kind:string;[key:string]:unknown}>;arrestSeverity?:string;arrestType?:string;[key:string]:unknown};
  type TestWorkspace={reports:Array<{id:string;runs:TestRun[];[key:string]:unknown}>};
  const {namespace,vault}=createVault();
  await vault.unlock(passphrase);
  const legacyRun={
    id:'legacy-arrest',clearanceRulesVersion:1,clearanceCode:'3V',arrestMade:true,transportedAfterArrest:true,
    charges:[{id:'saved-charge',description:'Fictional saved charge detail'}],
    generatedDocuments:[{id:'legacy-arrest:complaint:saved-charge',kind:'Criminal Complaint Form',chargeId:'saved-charge',description:'Fictional saved charge detail'}],
  };
  const initialArrest={
    id:'current-arrest',clearanceRulesVersion:1,arrestClassificationVersion:1,arrestSeverity:'Felony',arrestType:'On-view',
    clearanceCode:'3V',arrestMade:true,transportedAfterArrest:true,
  };
  const initialRun={...initialArrest,generatedDocuments:[
    {id:'current-arrest:U-10.100',kind:'U-10.100'},
    {id:'current-arrest:Probable-Cause-Affidavit',kind:'Probable Cause Affidavit'},
  ]};
  await vault.saveWorkspace({reports:[{id:'arrest-report',runs:[legacyRun,initialRun]}]});
  vault.lock();

  const reopened=new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  const loaded=await reopened.get<TestWorkspace>('workspace');
  assert.ok(loaded);
  assert.deepEqual(loaded.reports[0].runs[0].charges,legacyRun.charges);
  assert.deepEqual(loaded.reports[0].runs[0].generatedDocuments,legacyRun.generatedDocuments);
  assert.equal(loaded.reports[0].runs[1].arrestSeverity,'Felony');

  const edited={...loaded.reports[0].runs[1],arrestSeverity:'Misdemeanor',arrestType:'Warrant'};
  const editedRun={...edited,generatedDocuments:[{id:'current-arrest:U-10.100',kind:'U-10.100'}]};
  await reopened.saveWorkspace({reports:[{...loaded.reports[0],runs:[loaded.reports[0].runs[0],editedRun]}]});
  reopened.lock();

  const reopenedAgain=new OfflineStorage(namespace);
  await reopenedAgain.unlock(passphrase);
  const finalWorkspace=await reopenedAgain.get<TestWorkspace>('workspace');
  const current=finalWorkspace?.reports[0].runs[1];
  assert.equal(current?.arrestSeverity,'Misdemeanor');
  assert.equal(current?.arrestType,'Warrant');
  assert.deepEqual(current?.generatedDocuments?.map(document=>document.kind),['U-10.100']);
  assert.deepEqual(finalWorkspace?.reports[0].runs[0].charges,legacyRun.charges);
  reopenedAgain.lock();
});

test('draft sync rejects a sealing receipt and preserves pending edits',async()=>{
  const {vault}=createVault();
  await vault.unlock(passphrase);
  await vault.saveWorkspace({reports:[{id:'TEST-draft',narrative:'keep this'}]});
  await assert.rejects(vault.syncPacketBatch(async changes=>changes.map(change=>({
    id:change.recordId,operation_id:change.operationId,server_version:1,
    sync_status:'synchronized_complete' as 'local_draft_pending',content_hash:'a'.repeat(64),
  }))),/acknowledgement/);
  assert.equal(await vault.pendingCount(),1);
  vault.lock();
});

test('only an explicit matching returned correction can replace one sealed local copy',async()=>{
  const {vault}=createVault();await vault.unlock(passphrase);
  const original={id:'TEST-SEALED',syncStatus:'synchronized_complete',serverVersion:3,narrative:'Submitted original'};
  const other={id:'TEST-OTHER',syncStatus:'synchronized_complete',serverVersion:1,narrative:'Other sealed packet'};
  const correction={...original,syncStatus:'local_draft_pending',narrative:'Corrected draft'};
  try{
    await vault.saveWorkspace({reports:[original,other]});
    await vault.saveWorkspace({reports:[correction]});
    assert.deepEqual((await vault.get<{reports:typeof original[]}>('workspace'))?.reports,[original,other]);
    await assert.rejects(vault.saveWorkspace({reports:[correction,other]},{
      correction:{id:original.id,version:2},
    }),/does not match/);
    assert.equal(await vault.pendingCount(),0);
    await vault.saveWorkspace({reports:[correction]},{
      correction:{id:original.id,version:3},
    });
    const saved=await vault.get<{reports:typeof original[]}>('workspace');
    assert.deepEqual(saved?.reports,[correction,other]);
    assert.equal(await vault.pendingCount(),1);
    assert.equal(original.narrative,'Submitted original');
  }finally{vault.lock();}
});

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

test('universal assignment and mapped district survive an encrypted workspace reopen', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  const assignment = {
    id: 'universal-assignment',
    className: 'Class 27-A',
    recruitName: 'Test PO',
    recruitBadge: 'PO-1',
    ftoBadge: 'FTO-1',
    phase: 2 as const,
    phaseStartDate: '2026-11-22',
    shift: 'DMW' as const,
    zone: '3',
    precinct: '15',
    cruiserDistrict: '9150',
    ftoAssignment: '80C-1',
  };
  const folder = {
    assignmentId: assignment.id,
    className: assignment.className,
    recruitName: assignment.recruitName,
    recruitBadge: assignment.recruitBadge,
    ftoName: 'Test FTO',
    ftoBadge: assignment.ftoBadge,
    phase: assignment.phase,
    phaseStartDate: assignment.phaseStartDate,
    shift: assignment.shift,
    zone: assignment.zone,
    precinct: assignment.precinct,
    cruiserDistrict: assignment.cruiserDistrict,
    ftoAssignment: assignment.ftoAssignment,
    daysOff: [0, 1, 2],
    openedAt: '2026-11-22T12:00:00.000Z',
  };
  const workspace = { reports: [], assignments: [assignment], caseFolder: folder, phaseFolders: [folder] };
  await vault.saveWorkspace(workspace);
  vault.lock();

  const reopened = new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  const restored = await reopened.get<typeof workspace>('workspace');
  assert.equal(restored?.assignments[0]?.ftoAssignment, '80C-1');
  assert.equal(restored?.assignments[0]?.cruiserDistrict, '9150');
  assert.equal(restored?.caseFolder.ftoAssignment, '80C-1');
  assert.equal(restored?.caseFolder.cruiserDistrict, '9150');
  assert.equal(restored?.caseFolder.shift, 'DMW');
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
      server_version: 1, sync_status: 'local_draft_pending',content_hash:'a'.repeat(64) }));
  });
  assert.equal(next?.reports[0].syncStatus, 'local_draft_pending');
  assert.equal(await vault.pendingCount(), 0);
  // Draft synchronization does not seal the report: subsequent edits queue again.
  await vault.saveWorkspace(workspace);
  assert.equal((await vault.get<typeof workspace>('workspace'))?.reports[0].syncStatus, 'local_draft_pending');
  assert.equal(await vault.pendingCount(), 1);
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
      server_version: 1, sync_status: 'local_draft_pending',content_hash:'a'.repeat(64) }));
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
      server_version: 1, sync_status: 'local_draft_pending',content_hash:'a'.repeat(64) }];
  });
  assert.equal(acknowledged?.reports[0].syncStatus, 'local_draft_pending');
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

test('workspace revision checks block stale session writes unless explicitly overwritten', async () => {
  const namespace = `workspace-conflict-${crypto.randomUUID()}`;
  const first = new OfflineStorage(namespace);
  await first.unlock(passphrase);
  await first.saveWorkspace({ reports: [], note: 'starting version' });

  const second = new OfflineStorage(namespace);
  await second.unlock(passphrase);
  assert.equal((await second.get<{ note: string }>('workspace'))?.note, 'starting version');

  await first.saveWorkspace({ reports: [], note: 'first session version' });
  await assert.rejects(
    second.saveWorkspace({ reports: [], note: 'stale second session version' }),
    WorkspaceConflictError,
  );
  assert.equal((await first.get<{ note: string }>('workspace'))?.note, 'first session version');

  await second.saveWorkspace({ reports: [], note: 'confirmed overwrite version' }, { overwrite: true });
  assert.equal((await first.get<{ note: string }>('workspace'))?.note, 'confirmed overwrite version');
});

test('recovery snapshots restore local work without changing the agency sync queue', async () => {
  const { namespace, vault } = createVault();
  await vault.unlock(passphrase);
  const report = { id: 'p1', syncStatus: 'local_draft_pending', narrative: 'same queued packet' };
  await vault.saveWorkspace({ reports: [report], note: 'saved base' });
  let originalOperationId = '';
  await assert.rejects(vault.syncPacketBatch(async changes => {
    originalOperationId = changes[0].operationId;
    throw new Error('keep this packet queued');
  }), /keep this packet queued/);

  const recoveryId = await vault.saveRecoverySnapshot(
    { reports: [report], note: 'work from the tab that will be replaced' },
    'replaced-session',
  );
  const reopened = new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  await reopened.saveWorkspace({ reports: [report], note: 'workspace after overwrite' }, { overwrite: true });
  assert.equal(await reopened.pendingCount(), 1);
  assert.equal((await reopened.getLocalOnlyDrafts<{ id: string }>()).length, 0);

  const recovered = await reopened.restoreRecoverySnapshot<{ reports: typeof report[]; note: string }>(recoveryId);
  assert.equal(recovered.note, 'work from the tab that will be replaced');
  assert.equal((await reopened.get<{ note: string }>('workspace'))?.note, recovered.note);
  assert.equal(await reopened.pendingCount(), 1);
  assert.equal(await reopened.recoverySyncReviewRequired(), true);
  assert.equal((await reopened.getRecoverySnapshots()).length, 0);

  await reopened.syncPacketBatch(async changes => {
    assert.equal(changes[0].operationId, originalOperationId);
    assert.deepEqual(changes[0].value, report);
    return [{ id: 'p1', operation_id: originalOperationId, server_version: 1, sync_status: 'local_draft_pending',content_hash:'a'.repeat(64) }];
  });
  assert.equal(await reopened.pendingCount(), 0);
});

test('expired recovery snapshots are removed and cannot be restored', async () => {
  const { vault } = createVault();
  await vault.unlock(passphrase);
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  let recoveryId: string;
  try {
    recoveryId = await vault.saveRecoverySnapshot({ reports: [], note: 'expired' }, 'old-session');
  } finally {
    Date.now = originalNow;
  }
  now += 8 * 24 * 60 * 60 * 1000;
  Date.now = () => now;
  try {
    await assert.rejects(vault.restoreRecoverySnapshot(recoveryId!), /expired and was deleted/);
    assert.equal((await vault.getRecoverySnapshots()).length, 0);
  } finally {
    Date.now = originalNow;
  }
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
      root.render(createElement(WorkspaceProvider, {
        storageNamespace: namespace,
        previewOnly: true,
        children: createElement(Probe),
      }));
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
      await assert.rejects(current!.submitPhaseExtensionRequest({
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
      }),/Shared requests are disabled/);
      await current!.saveLocalChatDraft({
        id: 'preview-chat',
        sender: 'Preview user',
        body: 'Memory only',
        createdAt: new Date().toISOString(),
      });
    });
    assert.equal(current!.ws.phaseExtensionRequests.some(request=>request.id==='preview-extension'),false);
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
      root.render(createElement(WorkspaceProvider, {
        storageNamespace: namespace,
        previewOnly: true,
        children: createElement(Probe),
      }));
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

test('editing and synchronizing a preview packet never calls the agency upload API', async () => {
  const namespace = `preview-sync-only-${crypto.randomUUID()}`;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globalKeys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT'];
  const previousGlobals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
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

  const packetUploadRequests: string[] = [];
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/training-packets/sync')) packetUploadRequests.push(url);
      throw new Error(`Unexpected network request in preview test: ${url}`);
    },
  });

  let current: ReturnType<typeof useWorkspace> | undefined;
  function Probe() {
    current = useWorkspace();
    return null;
  }

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(WorkspaceProvider, {
        storageNamespace: namespace,
        previewOnly: true,
        children: createElement(Probe),
      }));
    });
    assert.ok(current);
    const previewPacket: Report = {
      id: 'preview-packet',
      date: '2026-11-23',
      shift: 'A-Co',
      phase: 3,
      zone: '1',
      precinct: '1',
      cruiserDistrict: '10',
      className: 'UI TEST ONLY',
      recruitName: 'DEMO PO',
      recruitBadge: 'DEMO-PO',
      ftoName: 'DEMO FTO',
      ftoBadge: 'DEMO-FTO',
      activity: emptyDailyActivitySummary(),
      runs: [],
      reportingForDuty: emptyReportingForDutyRecord(),
      ratings: emptyRatings(),
      narrative: 'Fictional preview packet',
      remedial: '',
      recruitComments: '',
      status: 'draft',
      signatures: {},
      createdAt: '2026-11-23T12:00:00.000Z',
      updatedAt: '2026-11-23T12:00:00.000Z',
    };

    await act(async () => {
      current!.upsertReport({ ...previewPacket, narrative: 'Edited fictional preview packet' });
    });
    assert.equal(current!.ws.reports[0]?.narrative, 'Edited fictional preview packet');
    assert.equal(current!.ws.reports[0]?.syncStatus, 'local_draft_pending');

    await act(async () => { await current!.syncPackets(); });
    assert.deepEqual(packetUploadRequests, []);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    if (previousFetch) Object.defineProperty(globalThis, 'fetch', previousFetch);
    else delete (globalThis as Record<string, unknown>).fetch;
  }
});

test('simultaneous preview workspaces isolate edits and never create device storage records', async () => {
  const namespace = `preview-isolation-${crypto.randomUUID()}`;
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

  const workspaces = new Map<string, ReturnType<typeof useWorkspace>>();
  function Probe({ id }: { id: string }) {
    workspaces.set(id, useWorkspace());
    return null;
  }

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement('div', null,
        createElement(WorkspaceProvider, {
          storageNamespace: namespace, previewOnly: true, children: createElement(Probe, { id: 'first' }),
        }),
        createElement(WorkspaceProvider, {
          storageNamespace: namespace, previewOnly: true, children: createElement(Probe, { id: 'second' }),
        }),
      ));
    });

    const first = workspaces.get('first')!;
    const second = workspaces.get('second')!;
    assert.ok(first && second);
    assert.equal(first.ws.caseFolder?.recruitName, 'DEMO PO');
    assert.equal(second.ws.caseFolder?.recruitName, 'DEMO PO');
    assert.notEqual(first.ws, second.ws);
    assert.deepEqual(await indexedDB.databases().then(databases =>
      databases.filter(database => database.name === databaseName)), []);

    await act(async () => {
      first.setCaseFolder({ ...first.ws.caseFolder!, recruitName: 'FIRST PREVIEW EDIT' });
    });

    assert.equal(workspaces.get('first')!.ws.caseFolder?.recruitName, 'FIRST PREVIEW EDIT');
    assert.equal(workspaces.get('second')!.ws.caseFolder?.recruitName, 'DEMO PO');
    assert.equal(workspaces.get('first')!.dirty, true);
    assert.equal(workspaces.get('second')!.dirty, false);

    // Allow the unlocked-preview autosave timer to run; it must remain memory-only.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 850));
    });
    assert.equal(workspaces.get('second')!.ws.caseFolder?.recruitName, 'DEMO PO');
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

test('saved sessions announce conflicts and an overwrite locks the stale tab', async () => {
  const namespace = `saved-session-conflict-${crypto.randomUUID()}`;
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

  const workspaces = new Map<string, ReturnType<typeof useWorkspace>>();
  function Probe({ id }: { id: string }) {
    workspaces.set(id, useWorkspace());
    return null;
  }

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement('div', null,
        createElement(WorkspaceProvider, {
          storageNamespace: namespace, children: createElement(Probe, { id: 'first' }),
        }),
        createElement(WorkspaceProvider, {
          storageNamespace: namespace, children: createElement(Probe, { id: 'second' }),
        }),
      ));
    });

    await act(async () => { await workspaces.get('first')!.setupAndSave('shared-test-passphrase'); });
    await act(async () => { await workspaces.get('second')!.unlockAndRestore('shared-test-passphrase'); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });

    const startingFolder = createUiPreviewWorkspace().caseFolder!;
    await act(async () => {
      workspaces.get('first')!.setCaseFolder({ ...startingFolder, recruitName: 'FIRST SESSION EDIT' });
      workspaces.get('second')!.setCaseFolder({ ...startingFolder, recruitName: 'SECOND SESSION EDIT' });
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    assert.ok(workspaces.get('first')!.otherSessions.some(session => session.unlocked && session.dirty));
    assert.ok(workspaces.get('second')!.otherSessions.some(session => session.unlocked && session.dirty));

    await act(async () => { workspaces.get('second')!.setEditorDirty(true); });
    await act(async () => {
      await assert.rejects(workspaces.get('first')!.overwriteOtherSessions(), /Save or close the open form/);
    });
    assert.equal(workspaces.get('second')!.vault, 'unlocked');
    assert.equal(workspaces.get('first')!.recoverySnapshots.length, 0);
    await act(async () => { workspaces.get('second')!.setEditorDirty(false); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });

    await act(async () => {
      await workspaces.get('first')!.overwriteOtherSessions();
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    assert.equal(workspaces.get('first')!.dirty, false);
    assert.equal(workspaces.get('second')!.vault, 'none');
    assert.equal(workspaces.get('second')!.overwrittenElsewhere, true);
    assert.equal(workspaces.get('first')!.recoverySnapshots.length, 1);

    await act(async () => { await new Promise(resolve => setTimeout(resolve, 850)); });
    await act(async () => { await workspaces.get('second')!.unlockAndRestore('shared-test-passphrase'); });
    assert.equal(workspaces.get('second')!.ws.caseFolder?.recruitName, 'FIRST SESSION EDIT');
    assert.equal(workspaces.get('second')!.overwrittenElsewhere, false);
    assert.equal(workspaces.get('second')!.recoverySnapshots.length, 1);
    const recoveryId = workspaces.get('second')!.recoverySnapshots[0]!.id;
    await act(async () => { await workspaces.get('second')!.restoreRecoverySnapshot(recoveryId); });
    assert.equal(workspaces.get('second')!.ws.caseFolder?.recruitName, 'SECOND SESSION EDIT');
    assert.equal(workspaces.get('second')!.recoverySnapshots.length, 0);
    assert.equal(workspaces.get('second')!.recoverySyncReviewRequired, true);
    await assert.rejects(workspaces.get('second')!.syncPackets(), /Save the restored workspace locally/);
    await act(async () => { await workspaces.get('second')!.saveNow(); });
    assert.equal(workspaces.get('second')!.recoverySyncReviewRequired, false);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});

test('waking refreshes locked unsaved presence and expires closed session conflicts', async () => {
  const namespace = `saved-session-wake-${crypto.randomUUID()}`;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globalKeys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT', 'BroadcastChannel'];
  const previous = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;

  const channels = new Map<string, Set<TestBroadcastChannel>>();
  class TestBroadcastChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(readonly name: string) {
      const peers = channels.get(name) ?? new Set<TestBroadcastChannel>();
      peers.add(this);
      channels.set(name, peers);
    }
    postMessage(data: unknown) {
      for (const peer of channels.get(this.name) ?? []) {
        if (peer !== this) peer.onmessage?.({ data } as MessageEvent);
      }
    }
    close() {
      channels.get(this.name)?.delete(this);
    }
  }
  const testGlobals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
    BroadcastChannel: TestBroadcastChannel,
  };
  for (const [key, value] of Object.entries(testGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const workspaces = new Map<string, ReturnType<typeof useWorkspace>>();
  function Probe() {
    workspaces.set('current', useWorkspace());
    return null;
  }
  const channelName = `fieldready-workspace:${namespace}`;
  const peer = new TestBroadcastChannel(channelName);
  const closedPeer = new TestBroadcastChannel(channelName);
  const peerMessages: Array<{ type: string; sessionId: string; dirty?: boolean; unlocked?: boolean }> = [];
  peer.onmessage = event => peerMessages.push(event.data);
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(WorkspaceProvider, {
        storageNamespace: namespace, children: createElement(Probe),
      }));
    });
    await act(async () => {
      await workspaces.get('current')!.setupAndSave('shared-test-passphrase');
    });
    await act(async () => {
      closedPeer.postMessage({ type: 'status', sessionId: 'closed-tab', dirty: true, unlocked: true, seenAt: now });
      closedPeer.close(); // simulate a tab that closed without sending a close notice
    });
    assert.ok(workspaces.get('current')!.otherSessions.some(session => session.sessionId === 'closed-tab'));

    now += 16_000; // exceed the 15-second session expiry without delivering a heartbeat
    await act(async () => {
      await assert.rejects(workspaces.get('current')!.overwriteOtherSessions(), /No other unlocked session is available/);
    });
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('focus'));
    });
    assert.equal(workspaces.get('current')!.otherSessions.some(session => session.sessionId === 'closed-tab'), false);
    assert.equal(peerMessages.some(message => message.type === 'overwrite'), false);

    await act(async () => {
      workspaces.get('current')!.setCaseFolder({
        ...createUiPreviewWorkspace().caseFolder!,
        recruitName: 'UNSAVED BEFORE SLEEP',
      });
    });
    await act(async () => {
      workspaces.get('current')!.lockNow('idle');
    });
    assert.equal(workspaces.get('current')!.lockedWithUnsaved, true);

    now += 16_000;
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('focus'));
    });
    const ownSessionId = peerMessages.find(message => message.type === 'status')?.sessionId;
    assert.ok(ownSessionId);
    assert.deepEqual(
      peerMessages.filter(message => message.type === 'status' && message.sessionId === ownSessionId).at(-1),
      { type: 'status', sessionId: ownSessionId, dirty: true, unlocked: false, seenAt: now },
    );

    await assert.rejects(workspaces.get('current')!.overwriteOtherSessions(), /Unlock the local vault/);
    assert.equal(peerMessages.some(message => message.type === 'overwrite'), false);
  } finally {
    await act(async () => { root.unmount(); });
    peer.close();
    closedPeer.close();
    dom.window.close();
    Date.now = originalNow;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});
