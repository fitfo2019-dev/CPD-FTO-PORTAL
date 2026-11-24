/**
 * Encrypted offline vault. No credentials, keys, record contents, or queued
 * payloads are written in plaintext. Call lock() and clear UI state on timeout.
 * This is not an identity provider or a guarantee of device/CJIS compliance.
 */
import { OperatorFacingError } from './operator-errors.js';
type Envelope = { id: string; iv: ArrayBuffer; ciphertext: ArrayBuffer };
type VaultMeta = { id: "vault"; salt: ArrayBuffer };
type WorkspaceRevision = { id: "workspace-revision"; revision: number };
type RecoverySyncReview = { id: "recovery-sync-review"; required: true };
export type RecoverySnapshot<T> = {
  id: string;
  capturedAt: string;
  expiresAt: string;
  sourceSessionId: string;
  workspace: T;
};

const RECOVERY_PREFIX = "recovery:";
const RECOVERY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class WorkspaceConflictError extends OperatorFacingError {
  constructor() {
    super("Another session saved a newer workspace. Review the session conflict before saving again.");
    this.name = "WorkspaceConflictError";
  }
}

export async function persistentStorageStatus(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persisted !== "function") return null;
  try { return await navigator.storage.persisted(); } catch { return null; }
}

/** Ask the browser to avoid automatic eviction of the encrypted local vault.
 * This is a best-effort durability request, not a backup or sync service. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
    return persistentStorageStatus();
  }
  try { return await navigator.storage.persist(); } catch { return false; }
}

export type PendingChange<T = unknown> = {
  operationId: string;
  recordId: string;
  value: T;
  baseVersion: number;
  clientTimestamp: string;
  attempted?: boolean;
  amendmentOf?: string;
  amendmentReason?: string;
};
export type SyncResult =
  | { status: "accepted"; operationId: string; version: number }
  | { status: "conflict"; serverVersion: number };
export type SyncTransport = (change: PendingChange) => Promise<SyncResult>;
export type PacketBatchReceipt = { id: string; operation_id: string;
  server_version: number; sync_status: "local_draft_pending"; content_hash: string };
export type PacketFinalizationReceipt = { id: string; server_version: number;
  sync_status: "submitted_complete"; content_hash: string };
type PacketFinalizationChange<T> = {
  operationId: string; recordId: string; contentHash: string; value: T;
};
export const MAX_PACKET_BATCH_COUNT = 100;
export const MAX_PACKET_REQUEST_BYTES = 2 * 1024 * 1024;
export class PacketRequestTooLargeError extends Error {
  constructor(readonly packetId: string, readonly serializedBytes: number) {
    super(`Packet ${packetId} is ${serializedBytes} bytes and cannot fit in the 2 MB sync request limit.`);
    this.name = "PacketRequestTooLargeError";
  }
}
export function serializePacketBatchRequest(changes: PendingChange[]): string {
  return JSON.stringify({ packets: changes.map(change => ({
    operation_id: change.operationId, base_version: change.baseVersion, report: change.value,
    ...(change.amendmentOf ? { amendment_of: change.amendmentOf, amendment_reason: change.amendmentReason } : {}),
  })) });
}
export type LocalChatDraft = {
  id: string;
  sender: string;
  body: string;
  createdAt: string;
};

const encode = (value: string) => new TextEncoder().encode(value);
const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
const complete = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Storage transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Storage transaction failed"));
  });

export class OfflineStorage {
  private key?: CryptoKey;
  private epoch = 0;
  private database?: Promise<IDBDatabase>;
  private operations: Promise<unknown> = Promise.resolve();
  private syncing = false;
  private workspaceRevision = 0;

  constructor(private readonly namespace: string) {}
  get isUnlocked() { return !!this.key; }

  private db(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const open = indexedDB.open(`fieldready-vault-${this.namespace}`, 2);
        open.onupgradeneeded = () => {
          for (const store of ["records", "sync_queue", "meta", "local_drafts"]) {
            if (!open.result.objectStoreNames.contains(store)) {
              open.result.createObjectStore(store, { keyPath: "id" });
            }
          }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error("Close other Field Training Officer Portal tabs to open storage."));
      });
    }
    return this.database;
  }

  private async read<T>(store: string, id: string): Promise<T | undefined> {
    const db = await this.db();
    return request(db.transaction(store).objectStore(store).get(id));
  }

  private seal(key: CryptoKey, id: string, value: unknown): Promise<Envelope> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encode(`${this.namespace}:${id}`) },
      key, encode(JSON.stringify(value)),
    ).then(ciphertext => ({ id, iv: iv.buffer, ciphertext }));
  }

  private async open<T>(key: CryptoKey, envelope: Envelope): Promise<T> {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: envelope.iv, additionalData: encode(`${this.namespace}:${envelope.id}`) },
      key, envelope.ciphertext,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }

  /** This local vault derives its key from the supplied passphrase bytes.
   * Operational per-user keys require verified identity and an approved stable wrapping-key design. */
  async unlock(secret: Uint8Array): Promise<void> {
    const epoch = ++this.epoch;
    this.key = undefined;
    const db = await this.db();
    const meta = await this.read<VaultMeta>("meta", "vault");
    const salt = meta?.salt ?? crypto.getRandomValues(new Uint8Array(32)).buffer;
    const material = await crypto.subtle.importKey("raw", new Uint8Array(secret), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", iterations: 600_000, salt },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
    if (meta) {
      const verifier = await this.read<Envelope>("meta", "verifier");
      if (!verifier || await this.open<string>(key, verifier) !== "fieldready-vault-v1") {
        throw new Error("Unable to unlock this vault.");
      }
    } else {
      const verifier = await this.seal(key, "verifier", "fieldready-vault-v1");
      if (epoch !== this.epoch) throw new Error("Vault was locked.");
      const tx = db.transaction("meta", "readwrite");
      const done = complete(tx);
      // add rather than put: concurrent setup cannot replace another vault.
      tx.objectStore("meta").add({ id: "vault", salt });
      tx.objectStore("meta").add(verifier);
      await done;
    }
    if (epoch !== this.epoch) throw new Error("Vault was locked.");
    this.key = key;
  }

  lock(): void { this.epoch++; this.key = undefined; }

  private session(): { key: CryptoKey; epoch: number } {
    if (!this.key) throw new Error("Unlock the local vault first.");
    return { key: this.key, epoch: this.epoch };
  }
  private assertActive(epoch: number): void {
    if (!this.key || epoch !== this.epoch) throw new Error("Vault session expired.");
  }

  private async advanceWorkspaceRevision(
    tx: IDBTransaction,
    done: Promise<void>,
    expectedRevision: number,
  ): Promise<number> {
    const current = await request<WorkspaceRevision | undefined>(
      tx.objectStore("meta").get("workspace-revision"),
    );
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      tx.abort();
      await done.catch(() => {});
      throw new WorkspaceConflictError();
    }
    const nextRevision = currentRevision + 1;
    tx.objectStore("meta").put({ id: "workspace-revision", revision: nextRevision });
    return nextRevision;
  }

  async get<T>(id: string): Promise<T | undefined> {
    const { key, epoch } = this.session();
    let envelope: Envelope | undefined;
    if (id === "workspace") {
      const db = await this.db();
      const tx = db.transaction(["records", "meta"], "readonly");
      const done = complete(tx);
      const [record, revision] = await Promise.all([
        request<Envelope | undefined>(tx.objectStore("records").get(id)),
        request<WorkspaceRevision | undefined>(tx.objectStore("meta").get("workspace-revision")),
      ]);
      await done;
      envelope = record;
      this.workspaceRevision = revision?.revision ?? 0;
    } else {
      envelope = await this.read<Envelope>("records", id);
    }
    const value = envelope ? await this.open<T>(key, envelope) : undefined;
    this.assertActive(epoch);
    return value;
  }

  /** Serializes writes; record and queue entry commit in one atomic transaction. */
  save<T>(id: string, value: T, baseVersion = 0): Promise<void> {
    const { key, epoch } = this.session();
    const snapshot = structuredClone(value);
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const change: PendingChange<T> = {
        operationId: crypto.randomUUID(), recordId: id, value: snapshot,
        baseVersion, clientTimestamp: new Date().toISOString(),
      };
      const [record, queued, db] = await Promise.all([
        this.seal(key, id, snapshot), this.seal(key, change.operationId, change), this.db(),
      ]);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue"], "readwrite");
      const done = complete(tx);
      tx.objectStore("records").put(record);
      tx.objectStore("sync_queue").add(queued);
      await done;
    });
    this.operations = run;
    return run;
  }

  async pendingCount(): Promise<number> {
    const db = await this.db();
    const queued = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
    return queued.filter(entry => !entry.id.startsWith("finalize:")).length;
  }

  async pendingPacketCount(): Promise<number> {
    const db = await this.db();
    const queued = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
    return queued.filter(entry => entry.id.startsWith("packet:")).length;
  }

  async recoverySyncReviewRequired(): Promise<boolean> {
    const marker = await this.read<RecoverySyncReview>("meta", "recovery-sync-review");
    return marker?.required === true;
  }

  /** Keep a session's local workspace encrypted and separate from agency sync. */
  saveRecoverySnapshot<T>(workspace: T, sourceSessionId: string): Promise<string> {
    const { key, epoch } = this.session();
    const id = `${RECOVERY_PREFIX}${crypto.randomUUID()}`;
    const capturedAt = new Date().toISOString();
    const value: RecoverySnapshot<T> = {
      id,
      capturedAt,
      expiresAt: new Date(Date.now() + RECOVERY_RETENTION_MS).toISOString(),
      sourceSessionId,
      workspace: structuredClone(workspace),
    };
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const [envelope, db] = await Promise.all([this.seal(key, id, value), this.db()]);
      this.assertActive(epoch);
      const tx = db.transaction("local_drafts", "readwrite");
      const done = complete(tx);
      tx.objectStore("local_drafts").put(envelope);
      await done;
      return id;
    });
    this.operations = run;
    return run;
  }

  /** Return unexpired recovery copies and remove expired encrypted entries. */
  async getRecoverySnapshots<T>(): Promise<Array<RecoverySnapshot<T>>> {
    const { key, epoch } = this.session();
    const db = await this.db();
    const envelopes = await request<Envelope[]>(
      db.transaction("local_drafts").objectStore("local_drafts").getAll(),
    );
    const snapshots: RecoverySnapshot<T>[] = [];
    const expired: string[] = [];
    for (const envelope of envelopes) {
      if (!envelope.id.startsWith(RECOVERY_PREFIX)) continue;
      const snapshot = await this.open<RecoverySnapshot<T>>(key, envelope);
      if (Date.parse(snapshot.expiresAt) <= Date.now()) expired.push(envelope.id);
      else snapshots.push(snapshot);
    }
    this.assertActive(epoch);
    if (expired.length) {
      const tx = db.transaction("local_drafts", "readwrite");
      const done = complete(tx);
      for (const id of expired) tx.objectStore("local_drafts").delete(id);
      await done;
    }
    return snapshots.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  }

  /**
   * Restore only the encrypted local workspace record. The agency sync queue is
   * deliberately not read, written, or regenerated by this operation.
   */
  restoreRecoverySnapshot<T>(id: string, reconcile?: (current: T | undefined, recovered: T) => T): Promise<T> {
    if (!id.startsWith(RECOVERY_PREFIX)) return Promise.reject(new Error("Recovery copy not found."));
    const { key, epoch } = this.session();
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const envelope = await request<Envelope | undefined>(
        db.transaction("local_drafts").objectStore("local_drafts").get(id),
      );
      if (!envelope) throw new Error("Recovery copy is no longer available.");
      const snapshot = await this.open<RecoverySnapshot<T>>(key, envelope);
      if (Date.parse(snapshot.expiresAt) <= Date.now()) {
        const expiredTx = db.transaction("local_drafts", "readwrite");
        const expiredDone = complete(expiredTx);
        expiredTx.objectStore("local_drafts").delete(id);
        await expiredDone;
        throw new Error("This recovery copy expired and was deleted.");
      }
      const currentTx = db.transaction(["records", "meta"], "readonly");
      const currentDone = complete(currentTx);
      const [currentEnvelope, currentRevision] = await Promise.all([
        request<Envelope | undefined>(currentTx.objectStore("records").get("workspace")),
        request<WorkspaceRevision | undefined>(currentTx.objectStore("meta").get("workspace-revision")),
      ]);
      await currentDone;
      const current = currentEnvelope ? await this.open<T>(key, currentEnvelope) : undefined;
      const restoredWorkspace = reconcile
        ? reconcile(current, snapshot.workspace)
        : snapshot.workspace;
      const workspace = await this.seal(key, "workspace", restoredWorkspace);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "meta", "local_drafts"], "readwrite");
      const done = complete(tx);
      const nextRevision = await this.advanceWorkspaceRevision(
        tx,
        done,
        currentRevision?.revision ?? 0,
      );
      tx.objectStore("records").put(workspace);
      tx.objectStore("meta").put({ id: "recovery-sync-review", required: true } satisfies RecoverySyncReview);
      tx.objectStore("local_drafts").delete(id);
      await done;
      this.workspaceRevision = nextRevision;
      return restoredWorkspace;
    });
    this.operations = run;
    return run;
  }

  /** Local workspace and latest per-packet queue entries commit together.
   * Legacy workspace queue entries are never sent by syncPacketBatch(). */
  saveWorkspace<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number;
    serverContentHash?: string; draftSyncPending?: boolean; syncAttemptPending?: boolean;
    finalizationAttemptPending?: boolean; amendmentOf?: string; amendmentReason?: string }> }>(
    workspace: T,
    options: { overwrite?: boolean; correction?: { id: string; version: number } } = {},
  ): Promise<void> {
    const { key, epoch } = this.session();
    const snapshot = structuredClone(workspace);
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const snapshotTx = db.transaction(["records", "meta"], "readonly");
      const snapshotDone = complete(snapshotTx);
      const [savedEnvelope, revision] = await Promise.all([
        request<Envelope | undefined>(snapshotTx.objectStore("records").get("workspace")),
        request<WorkspaceRevision | undefined>(snapshotTx.objectStore("meta").get("workspace-revision")),
      ]);
      await snapshotDone;
      const baseRevision = revision?.revision ?? 0;
      const saved = savedEnvelope ? await this.open<T>(key, savedEnvelope) : undefined;
      // A delayed autosave cannot overwrite a server-confirmed sealed packet.
      for (const sealed of saved?.reports ?? []) {
        if (sealed.syncStatus === "local_draft_pending" && (sealed.serverVersion ?? 0) > 0) {
          const index = snapshot.reports.findIndex(report => report.id === sealed.id);
          if (index < 0) {
            snapshot.reports.push(sealed);
            continue;
          }
          const candidate = snapshot.reports[index];
          const stripState = (report: typeof candidate) => {
            const { syncStatus: _status, serverVersion: _version, serverContentHash: _hash,
              draftSyncPending: _pending, syncAttemptPending: _syncAttempt,
              finalizationAttemptPending: _finalizeAttempt, ...content } = report;
            return content;
          };
          if (JSON.stringify(stripState(candidate)) === JSON.stringify(stripState(sealed))) {
            snapshot.reports[index] = sealed;
          } else {
            snapshot.reports[index] = { ...candidate, syncStatus: "local_draft_pending",
              serverVersion: sealed.serverVersion, serverContentHash: undefined, draftSyncPending: true };
          }
          continue;
        }
        if (sealed.syncStatus !== "submitted_complete" && sealed.syncStatus !== "synchronized_complete") continue;
        const index = snapshot.reports.findIndex(report => report.id === sealed.id);
        if (options.correction?.id === sealed.id) {
          const correction = snapshot.reports[index];
          if (!correction || correction.syncStatus !== "local_draft_pending" ||
            correction.serverVersion !== options.correction.version || sealed.serverVersion !== options.correction.version ||
            sealed.syncAttemptPending || sealed.finalizationAttemptPending)
            throw new Error("The returned correction does not match the saved submitted packet.");
          continue;
        }
        if (index >= 0) snapshot.reports[index] = sealed;
        else snapshot.reports.push(sealed);
      }
      const queued = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
      const previous = new Map<string, PendingChange>();
      for (const envelope of queued) {
        if (envelope.id.startsWith("packet:")) previous.set(envelope.id, await this.open<PendingChange>(key, envelope));
      }
      // Once transmission is attempted, even a timeout cannot prove that the
      // server did not commit. Keep its exact snapshot and operation ID.
      for (const [id, change] of previous) {
        if (!change.attempted) continue;
        const original = change.value as T["reports"][number];
        const candidate = snapshot.reports.find(report => `packet:${report.id}` === id);
        if (!candidate) {
          snapshot.reports.push({ ...original, syncAttemptPending: true });
          continue;
        }
        const { syncAttemptPending: _guard, ...content } = candidate;
        if (JSON.stringify(content) !== JSON.stringify(change.value)) {
          throw new Error("Reconcile the attempted packet upload before changing its saved contents.");
        }
        candidate.syncAttemptPending = true;
      }
      const finalizations = queued.filter(envelope => envelope.id.startsWith("finalize:"));
      for (const envelope of finalizations) {
        const change = await this.open<PacketFinalizationChange<T["reports"][number]>>(key, envelope);
        const candidate = snapshot.reports.find(report => report.id === change.recordId);
        if (!candidate) throw new Error("Reconcile the attempted packet finalization before removing its saved packet.");
        const { finalizationAttemptPending: _guard, ...content } = candidate;
        if (JSON.stringify(content) !== JSON.stringify(change.value))
          throw new Error("Reconcile the attempted packet finalization before changing its saved contents.");
        candidate.finalizationAttemptPending = true;
      }
      const envelopes: Envelope[] = [];
      const ids = new Set<string>();
      for (const report of snapshot.reports) {
        if (report.syncStatus === "submitted_complete" || report.syncStatus === "synchronized_complete" ||
          report.finalizationAttemptPending ||
          (report.syncStatus === "local_draft_pending" && report.draftSyncPending === false &&
            (report.serverVersion ?? 0) > 0)) continue;
        const id = `packet:${report.id}`;
        ids.add(id);
        const prior = previous.get(id);
        const change = prior && (prior.attempted || JSON.stringify(prior.value) === JSON.stringify(report)) ? prior : {
          operationId: crypto.randomUUID(), recordId: report.id, value: report,
          baseVersion: report.serverVersion ?? 0, clientTimestamp: new Date().toISOString(),
          ...(typeof report.amendmentOf === "string"
            ? { amendmentOf: report.amendmentOf, amendmentReason: report.amendmentReason }
            : {}),
        };
        envelopes.push(await this.seal(key, id, change));
      }
      const legacyWorkspaceIds = await Promise.all(queued
        .filter(envelope => !envelope.id.startsWith("packet:") && !envelope.id.startsWith("finalize:"))
        .map(async envelope => {
          const legacy = await this.open<PendingChange>(key, envelope);
          return legacy.recordId === "workspace" ? envelope.id : undefined;
        }));
      const record = await this.seal(key, "workspace", snapshot);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue", "meta"], "readwrite");
      const done = complete(tx);
      const nextRevision = await this.advanceWorkspaceRevision(
        tx,
        done,
        options.overwrite ? baseRevision : this.workspaceRevision,
      );
      tx.objectStore("records").put(record);
      tx.objectStore("meta").delete("recovery-sync-review");
      // Old whole-workspace operations are local-only legacy entries; removing
      // them is safe because their latest snapshot remains encrypted in records.
      for (const envelope of queued) {
        if (envelope.id.startsWith("packet:") && !ids.has(envelope.id))
          tx.objectStore("sync_queue").delete(envelope.id);
        else if (legacyWorkspaceIds.includes(envelope.id)) tx.objectStore("sync_queue").delete(envelope.id);
      }
      for (const envelope of envelopes) tx.objectStore("sync_queue").put(envelope);
      await done;
      this.workspaceRevision = nextRevision;
    });
    this.operations = run;
    return run;
  }

  /** One server transaction, followed by one local acknowledgement transaction.
   * No queue deletion or local sealing occurs on partial/malformed receipts. */
  syncPacketBatch<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number;
    serverContentHash?: string; draftSyncPending?: boolean; syncAttemptPending?: boolean; finalizationAttemptPending?: boolean }> }>(
    transport: (changes: PendingChange[]) => Promise<PacketBatchReceipt[]>,
  ): Promise<T | undefined> {
    if (this.syncing) return Promise.reject(new Error("Sync is already running."));
    const { key, epoch } = this.session();
    this.syncing = true;
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const envelopes = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
      const queuedPackets = envelopes.filter(item => item.id.startsWith("packet:"));
      if (!queuedPackets.length) return undefined;
      const packets: Envelope[] = [];
      const changes: PendingChange[] = [];
      for (const packet of queuedPackets) {
        if (packets.length >= MAX_PACKET_BATCH_COUNT) break;
        const change = await this.open<PendingChange>(key, packet);
        const bytes = new TextEncoder().encode(serializePacketBatchRequest([...changes, change])).byteLength;
        if (bytes > MAX_PACKET_REQUEST_BYTES) {
          if (!changes.length) throw new PacketRequestTooLargeError(change.recordId, bytes);
          break;
        }
        packets.push(packet); changes.push(change);
      }
      const workspaceEnvelope = await this.read<Envelope>("records", "workspace");
      if (!workspaceEnvelope) throw new Error("The saved local workspace is unavailable.");
      const before = await this.open<T>(key, workspaceEnvelope);
      const attemptedWorkspace = { ...before, reports: before.reports.map(report =>
        changes.some(change => change.recordId === report.id) ? { ...report, syncAttemptPending: true } : report) };
      const attemptedEntries = await Promise.all(packets.map((packet, index) =>
        this.seal(key, packet.id, { ...changes[index], attempted: true })));
      const guardedWorkspace = await this.seal(key, "workspace", attemptedWorkspace);
      this.assertActive(epoch);
      const attemptedTx = db.transaction(["records", "sync_queue", "meta"], "readwrite");
      const attemptDone = complete(attemptedTx);
      const attemptedRevision = await this.advanceWorkspaceRevision(attemptedTx, attemptDone, this.workspaceRevision);
      attemptedTx.objectStore("records").put(guardedWorkspace);
      for (const entry of attemptedEntries) attemptedTx.objectStore("sync_queue").put(entry);
      await attemptDone;
      this.workspaceRevision = attemptedRevision;
      const receipts = await transport(changes);
      this.assertActive(epoch);
      if (receipts.length !== changes.length || new Set(receipts.map(item => item.id)).size !== changes.length ||
        changes.some(change => !receipts.some(item => item.id === change.recordId &&
          item.operation_id === change.operationId && item.sync_status === "local_draft_pending" &&
          /^[a-f0-9]{64}$/.test(item.content_hash) &&
          Number.isInteger(item.server_version) && item.server_version >= 1))) {
        throw new Error("Invalid packet synchronization acknowledgement.");
      }
      const envelope = await this.read<Envelope>("records", "workspace");
      if (!envelope) throw new Error("The saved local workspace is unavailable.");
      const workspace = await this.open<T>(key, envelope);
      const next = { ...workspace, reports: workspace.reports.map(report => {
        const receipt = receipts.find(item => item.id === report.id);
        if (!receipt) return report;
        const original = changes.find(change => change.recordId === report.id)!.value as T["reports"][number];
        return { ...original, syncStatus: "local_draft_pending" as const,
          serverVersion: receipt.server_version, serverContentHash: receipt.content_hash,
          draftSyncPending: false, syncAttemptPending: false };
      }) };
      const sealed = await this.seal(key, "workspace", next);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue", "meta"], "readwrite");
      const done = complete(tx);
      const nextRevision = await this.advanceWorkspaceRevision(tx, done, this.workspaceRevision);
      tx.objectStore("records").put(sealed);
      for (const packet of packets) tx.objectStore("sync_queue").delete(packet.id);
      await done;
      this.workspaceRevision = nextRevision;
      return next as T;
    }).finally(() => { this.syncing = false; });
    this.operations = run;
    return run;
  }

  /** Drain bounded batches without duplicating acknowledged operations. */
  async syncPacketQueue<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number;
    serverContentHash?: string; draftSyncPending?: boolean; syncAttemptPending?: boolean; finalizationAttemptPending?: boolean }> }>(
    transport: (changes: PendingChange[]) => Promise<PacketBatchReceipt[]>,
    onBatchAcknowledged?: (workspace: T) => void,
    shouldContinue: () => boolean = () => true,
  ): Promise<T | undefined> {
    if (!await this.get<T>("workspace")) throw new Error("The saved local workspace is unavailable.");
    let latest: T | undefined;
    while (shouldContinue() && await this.pendingPacketCount() > 0) {
      const acknowledged = await this.syncPacketBatch<T>(transport);
      if (!acknowledged) throw new Error("Packet synchronization stopped while eligible packets remain queued.");
      latest = acknowledged; onBatchAcknowledged?.(acknowledged);
    }
    return latest;
  }

  /** Persist the exact finalization attempt before sending it, so uncertain
   * responses retry with the same operation ID and snapshot. */
  finalizePacket<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number;
    serverContentHash?: string; draftSyncPending?: boolean; syncAttemptPending?: boolean;
    finalizationAttemptPending?: boolean }> }>(
    recordId: string,
    transport: (id: string, operationId: string, contentHash: string) => Promise<PacketFinalizationReceipt>,
  ): Promise<T | undefined> {
    if (this.syncing) return Promise.reject(new Error("Packet synchronization is already running."));
    const { key, epoch } = this.session();
    this.syncing = true;
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const workspaceEnvelope = await this.read<Envelope>("records", "workspace");
      if (!workspaceEnvelope) throw new Error("The saved local workspace is unavailable.");
      const workspace = await this.open<T>(key, workspaceEnvelope);
      const report = workspace.reports.find(item => item.id === recordId);
      if (!report) throw new Error("The packet is not available in the saved workspace.");
      const queueId = `finalize:${recordId}`;
      const queuedEnvelope = await this.read<Envelope>("sync_queue", queueId);
      let change: PacketFinalizationChange<T["reports"][number]>;
      let guarded: T;
      if (queuedEnvelope) {
        change = await this.open<PacketFinalizationChange<T["reports"][number]>>(key, queuedEnvelope);
        const { finalizationAttemptPending: _guard, ...current } = report;
        if (change.contentHash !== report.serverContentHash ||
          JSON.stringify(current) !== JSON.stringify(change.value))
          throw new Error("Reconcile the attempted packet finalization before changing its saved contents.");
        guarded = workspace;
      } else {
        if (report.syncStatus !== "local_draft_pending" || !Number.isInteger(report.serverVersion) ||
          (report.serverVersion ?? 0) < 1 || !report.serverContentHash ||
          !/^[a-f0-9]{64}$/.test(report.serverContentHash) ||
          report.draftSyncPending !== false || report.syncAttemptPending || report.finalizationAttemptPending)
          throw new Error("Synchronize and save this packet draft before finalizing it.");
        const { finalizationAttemptPending: _guard, ...value } = report;
        change = { operationId: crypto.randomUUID(), recordId,
          contentHash: report.serverContentHash, value };
        guarded = { ...workspace, reports: workspace.reports.map(item =>
          item.id === recordId ? { ...item, finalizationAttemptPending: true } : item) };
        const [savedRecord, savedAttempt] = await Promise.all([
          this.seal(key, "workspace", guarded),
          this.seal(key, queueId, change),
        ]);
        this.assertActive(epoch);
        const tx = db.transaction(["records", "sync_queue", "meta"], "readwrite");
        const done = complete(tx);
        const revision = await this.advanceWorkspaceRevision(tx, done, this.workspaceRevision);
        tx.objectStore("records").put(savedRecord);
        tx.objectStore("sync_queue").put(savedAttempt);
        await done;
        this.workspaceRevision = revision;
      }
      const receipt = await transport(recordId, change.operationId, change.contentHash);
      this.assertActive(epoch);
      if (receipt.id !== recordId || receipt.sync_status !== "submitted_complete" ||
        receipt.content_hash !== change.contentHash ||
        !Number.isInteger(receipt.server_version) || receipt.server_version < 1)
        throw new Error("Invalid packet finalization acknowledgement.");
      const currentEnvelope = await this.read<Envelope>("records", "workspace");
      if (!currentEnvelope) throw new Error("The saved local workspace is unavailable.");
      const currentWorkspace = await this.open<T>(key, currentEnvelope);
      const next = { ...currentWorkspace, reports: currentWorkspace.reports.map(item => item.id !== recordId
        ? item
        : { ...change.value, syncStatus: "submitted_complete" as const,
          serverVersion: receipt.server_version, serverContentHash: receipt.content_hash,
          syncAttemptPending: false, finalizationAttemptPending: false }) };
      const saved = await this.seal(key, "workspace", next);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue", "meta"], "readwrite");
      const done = complete(tx);
      const revision = await this.advanceWorkspaceRevision(tx, done, this.workspaceRevision);
      tx.objectStore("records").put(saved);
      tx.objectStore("sync_queue").delete(queueId);
      await done;
      this.workspaceRevision = revision;
      return next as T;
    }).finally(() => { this.syncing = false; });
    this.operations = run;
    return run;
  }

  /** Encrypted device-only drafts; deliberately excluded from sync_queue. */
  async getLocalOnlyDrafts<T>(): Promise<T[]> {
    const { key, epoch } = this.session();
    const db = await this.db();
    const envelopes = await request<Envelope[]>(
      db.transaction("local_drafts").objectStore("local_drafts").getAll(),
    );
    const drafts = await Promise.all(envelopes
      .filter(envelope => !envelope.id.startsWith(RECOVERY_PREFIX))
      .map(envelope => this.open<T>(key, envelope)));
    this.assertActive(epoch);
    return drafts;
  }

  /** Save an encrypted unsent draft without creating a server-upload operation. */
  saveLocalOnlyDraft<T>(id: string, value: T): Promise<void> {
    const { key, epoch } = this.session();
    const snapshot = structuredClone(value);
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const [envelope, db] = await Promise.all([this.seal(key, id, snapshot), this.db()]);
      this.assertActive(epoch);
      const tx = db.transaction("local_drafts", "readwrite");
      const done = complete(tx);
      tx.objectStore("local_drafts").put(envelope);
      await done;
    });
    this.operations = run;
    return run;
  }

  /** Delete only the selected device-local draft; no sync record is generated. */
  deleteLocalOnlyDraft(id: string): Promise<void> {
    const { epoch } = this.session();
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const tx = db.transaction("local_drafts", "readwrite");
      const done = complete(tx);
      tx.objectStore("local_drafts").delete(id);
      await done;
    });
    this.operations = run;
    return run;
  }

  /**
   * Explicit authenticated transport injection. Queue entries are NEVER discarded
   * on network/auth/server failure or conflict. Server must enforce authorization,
   * idempotency by operationId, baseVersion checks, and signature transitions.
   * First build does not connect this to a live endpoint.
   */
  async sync(transport: SyncTransport): Promise<{ sent: number; conflicts: string[] }> {
    if (this.syncing) throw new Error("Sync is already running.");
    const { key, epoch } = this.session();
    this.syncing = true;
    let sent = 0;
    const conflicts: string[] = [];
    try {
      await this.operations;
      const db = await this.db();
      const envelopes = await request<Envelope[]>(
        db.transaction("sync_queue").objectStore("sync_queue").getAll(),
      );
      const changes = await Promise.all(envelopes.map(row => this.open<PendingChange>(key, row)));
      changes.sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
      for (const change of changes) {
        this.assertActive(epoch);
        if (conflicts.includes(change.recordId)) continue;
        const result = await transport(change);
        this.assertActive(epoch);
        if (result.status === "conflict") { conflicts.push(change.recordId); continue; }
        if (result.operationId !== change.operationId) throw new Error("Invalid sync acknowledgement.");
        const tx = db.transaction("sync_queue", "readwrite");
        const done = complete(tx);
        tx.objectStore("sync_queue").delete(change.operationId);
        await done;
        sent++;
      }
      return { sent, conflicts };
    } finally { this.syncing = false; }
  }
}
