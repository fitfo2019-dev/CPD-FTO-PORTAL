/**
 * Encrypted offline vault. No credentials, keys, record contents, or queued
 * payloads are written in plaintext. Call lock() and clear UI state on timeout.
 * This is not an identity provider or a guarantee of device/CJIS compliance.
 */
type Envelope = { id: string; iv: ArrayBuffer; ciphertext: ArrayBuffer };
type VaultMeta = { id: "vault"; salt: ArrayBuffer };

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
};
export type SyncResult =
  | { status: "accepted"; operationId: string; version: number }
  | { status: "conflict"; serverVersion: number };
export type SyncTransport = (change: PendingChange) => Promise<SyncResult>;
export type PacketBatchReceipt = { id: string; operation_id: string;
  server_version: number; sync_status: "synchronized_complete" };
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

  async get<T>(id: string): Promise<T | undefined> {
    const { key, epoch } = this.session();
    const envelope = await this.read<Envelope>("records", id);
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
    return request(db.transaction("sync_queue").objectStore("sync_queue").count());
  }

  /** Local workspace and latest per-packet queue entries commit together.
   * Legacy workspace queue entries are never sent by syncPacketBatch(). */
  saveWorkspace<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number }> }>(
    workspace: T,
  ): Promise<void> {
    const { key, epoch } = this.session();
    const snapshot = structuredClone(workspace);
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const savedEnvelope = await this.read<Envelope>("records", "workspace");
      const saved = savedEnvelope ? await this.open<T>(key, savedEnvelope) : undefined;
      // A delayed autosave cannot overwrite a server-confirmed sealed packet.
      for (const sealed of saved?.reports ?? []) {
        if (sealed.syncStatus !== "synchronized_complete") continue;
        const index = snapshot.reports.findIndex(report => report.id === sealed.id);
        if (index >= 0) snapshot.reports[index] = sealed;
        else snapshot.reports.push(sealed);
      }
      const queued = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
      const previous = new Map<string, PendingChange>();
      for (const envelope of queued) {
        if (envelope.id.startsWith("packet:")) previous.set(envelope.id, await this.open<PendingChange>(key, envelope));
      }
      const envelopes: Envelope[] = [];
      const ids = new Set<string>();
      for (const report of snapshot.reports) {
        if (report.syncStatus === "synchronized_complete") continue;
        const id = `packet:${report.id}`;
        ids.add(id);
        const prior = previous.get(id);
        const change = prior && JSON.stringify(prior.value) === JSON.stringify(report) ? prior : {
          operationId: crypto.randomUUID(), recordId: report.id, value: report,
          baseVersion: report.serverVersion ?? 0, clientTimestamp: new Date().toISOString(),
        };
        envelopes.push(await this.seal(key, id, change));
      }
      const record = await this.seal(key, "workspace", snapshot);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue"], "readwrite");
      const done = complete(tx);
      tx.objectStore("records").put(record);
      // Old whole-workspace operations are local-only legacy entries; removing
      // them is safe because their latest snapshot remains encrypted in records.
      for (const envelope of queued) {
        if (!ids.has(envelope.id)) tx.objectStore("sync_queue").delete(envelope.id);
      }
      for (const envelope of envelopes) tx.objectStore("sync_queue").put(envelope);
      await done;
    });
    this.operations = run;
    return run;
  }

  /** One server transaction, followed by one local acknowledgement transaction.
   * No queue deletion or local sealing occurs on partial/malformed receipts. */
  syncPacketBatch<T extends { reports: Array<{ id: string; syncStatus?: string; serverVersion?: number }> }>(
    transport: (changes: PendingChange[]) => Promise<PacketBatchReceipt[]>,
  ): Promise<T | undefined> {
    if (this.syncing) return Promise.reject(new Error("Sync is already running."));
    const { key, epoch } = this.session();
    this.syncing = true;
    const run = this.operations.catch(() => {}).then(async () => {
      this.assertActive(epoch);
      const db = await this.db();
      const envelopes = await request<Envelope[]>(db.transaction("sync_queue").objectStore("sync_queue").getAll());
      const packets = envelopes.filter(item => item.id.startsWith("packet:"));
      if (!packets.length) return undefined;
      const changes = await Promise.all(packets.map(item => this.open<PendingChange>(key, item)));
      const receipts = await transport(changes);
      this.assertActive(epoch);
      if (receipts.length !== changes.length || new Set(receipts.map(item => item.id)).size !== changes.length ||
        changes.some(change => !receipts.some(item => item.id === change.recordId &&
          item.operation_id === change.operationId && item.sync_status === "synchronized_complete" &&
          Number.isInteger(item.server_version) && item.server_version >= 1))) {
        throw new Error("Invalid packet synchronization acknowledgement.");
      }
      const envelope = await this.read<Envelope>("records", "workspace");
      if (!envelope) throw new Error("The saved local workspace is unavailable.");
      const workspace = await this.open<T>(key, envelope);
      const next = { ...workspace, reports: workspace.reports.map(report => {
        const receipt = receipts.find(item => item.id === report.id);
        return receipt ? { ...report, syncStatus: "synchronized_complete" as const,
          serverVersion: receipt.server_version } : report;
      }) };
      const sealed = await this.seal(key, "workspace", next);
      this.assertActive(epoch);
      const tx = db.transaction(["records", "sync_queue"], "readwrite");
      const done = complete(tx);
      tx.objectStore("records").put(sealed);
      for (const packet of packets) tx.objectStore("sync_queue").delete(packet.id);
      await done;
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
    const drafts = await Promise.all(envelopes.map(envelope => this.open<T>(key, envelope)));
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
