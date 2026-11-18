/**
 * Encrypted offline vault. No credentials, keys, record contents, or queued
 * payloads are written in plaintext. Call lock() and clear UI state on timeout.
 * This is not an identity provider or a guarantee of device/CJIS compliance.
 */
type Envelope = { id: string; iv: ArrayBuffer; ciphertext: ArrayBuffer };
type VaultMeta = { id: "vault"; salt: ArrayBuffer };
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
        const open = indexedDB.open(`fieldready-vault-${this.namespace}`, 1);
        open.onupgradeneeded = () => {
          for (const store of ["records", "sync_queue", "meta"]) {
            open.result.createObjectStore(store, { keyPath: "id" });
          }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error("Close other FieldReady tabs to open storage."));
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

  /** Demo accepts passphrase bytes; production must supply a stable, rewrapped
   * per-user secret after verified authentication, NOT a rotating access token. */
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
