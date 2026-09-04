import {
  idbRequest,
  idbTransactionComplete,
  openWorkspaceDatabase,
  STORE_ASSET_CACHE,
  STORE_SYNC_OUTBOX,
  STORE_SYNC_STATE
} from "./indexedDbSchema";
import {
  LIBRARY_KEY,
  MANIFEST_KEY,
  RECOVERY_KEY,
  STORE_ENCOUNTERS,
  STORE_LIBRARY,
  STORE_MANIFEST,
  STORE_RECOVERY
} from "./indexedDbSchema";
import type {
  CachedAsset,
  LocalSyncRepository,
  PendingSyncOperation,
  RecentEncounterAccess,
  StorageUsageSnapshot,
  SyncBaseline,
  SyncIdentity,
  SyncRecordKey
} from "./syncTypes";
import type { WorkspaceSnapshot } from "./types";

const IDENTITY_KEY = "identity";
const RECENTS_KEY = "recent_encounters";
const USAGE_KEY = "storage_usage";
const baselineKey = (key: SyncRecordKey) => `baseline:${key}`;

function createMutationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `mutation-${Date.now()}-${Math.random()}`;
}

export async function journalSyncMutation(
  transaction: IDBTransaction,
  key: SyncRecordKey,
  localRevision: number,
  operation: PendingSyncOperation["operation"]
): Promise<void> {
  const state = transaction.objectStore(STORE_SYNC_STATE);
  const identity = await idbRequest<SyncIdentity | undefined>(state.get(IDENTITY_KEY));
  if (!identity) return;
  const baseline = await idbRequest<SyncBaseline | undefined>(state.get(baselineKey(key)));
  const queued: PendingSyncOperation = {
    key,
    operation,
    mutationId: createMutationId(),
    localRevision,
    expectedRemoteRevision: baseline?.remoteRevision ?? null,
    queuedAt: Date.now()
  };
  transaction.objectStore(STORE_SYNC_OUTBOX).put(queued);
}

/** Durable sync and cache state kept separate from the local domain repository API. */
export class IndexedDbLocalSyncRepository implements LocalSyncRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName = "combat-zone",
    private readonly databaseVersion = 3
  ) {}

  private database(): Promise<IDBDatabase> {
    return (this.databasePromise ??= openWorkspaceDatabase(this.databaseName, this.databaseVersion));
  }

  private async read<T>(store: string, key: IDBValidKey): Promise<T | null> {
    const db = await this.database();
    const transaction = db.transaction(store, "readonly");
    const value = await idbRequest<T | undefined>(transaction.objectStore(store).get(key));
    await idbTransactionComplete(transaction);
    return value ?? null;
  }

  private async put(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(store, "readwrite");
    key === undefined
      ? transaction.objectStore(store).put(value)
      : transaction.objectStore(store).put(value, key);
    await idbTransactionComplete(transaction);
  }

  getSyncIdentity() { return this.read<SyncIdentity>(STORE_SYNC_STATE, IDENTITY_KEY); }

  async setSyncIdentity(identity: SyncIdentity | null): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(STORE_SYNC_STATE, "readwrite");
    identity
      ? transaction.objectStore(STORE_SYNC_STATE).put(identity, IDENTITY_KEY)
      : transaction.objectStore(STORE_SYNC_STATE).delete(IDENTITY_KEY);
    await idbTransactionComplete(transaction);
  }

  getSyncBaseline(key: SyncRecordKey) {
    return this.read<SyncBaseline>(STORE_SYNC_STATE, baselineKey(key));
  }

  setSyncBaseline(baseline: SyncBaseline) {
    return this.put(STORE_SYNC_STATE, baseline, baselineKey(baseline.key));
  }

  async listPendingSyncOperations(): Promise<PendingSyncOperation[]> {
    const db = await this.database();
    const transaction = db.transaction(STORE_SYNC_OUTBOX, "readonly");
    const values = await idbRequest<PendingSyncOperation[]>(transaction.objectStore(STORE_SYNC_OUTBOX).getAll());
    await idbTransactionComplete(transaction);
    return values.sort((left, right) => left.queuedAt - right.queuedAt);
  }

  async acknowledgeSyncOperation(key: SyncRecordKey, mutationId: string): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(STORE_SYNC_OUTBOX, "readwrite");
    const store = transaction.objectStore(STORE_SYNC_OUTBOX);
    const current = await idbRequest<PendingSyncOperation | undefined>(store.get(key));
    if (current?.mutationId === mutationId) store.delete(key);
    await idbTransactionComplete(transaction);
  }

  queueSyncOperation(operation: PendingSyncOperation) {
    return this.put(STORE_SYNC_OUTBOX, operation);
  }

  async recordRecentEncounterAccess(access: RecentEncounterAccess): Promise<void> {
    const current = await this.getRecentEncounterAccesses();
    const previous = current.find(({ encounterId }) => encounterId === access.encounterId);
    if (previous && previous.accessedAt >= access.accessedAt) return;
    const merged = [...current.filter(({ encounterId }) => encounterId !== access.encounterId), access]
      .sort((left, right) => right.accessedAt - left.accessedAt)
      .slice(0, 5);
    const db = await this.database();
    const transaction = db.transaction([STORE_SYNC_STATE, STORE_SYNC_OUTBOX], "readwrite");
    transaction.objectStore(STORE_SYNC_STATE).put(merged, RECENTS_KEY);
    await journalSyncMutation(transaction, "workspace", access.accessedAt, "upsert");
    await idbTransactionComplete(transaction);
  }

  async getRecentEncounterAccesses(): Promise<RecentEncounterAccess[]> {
    return (await this.read<RecentEncounterAccess[]>(STORE_SYNC_STATE, RECENTS_KEY)) ?? [];
  }

  async setStorageUsageSnapshot(snapshot: StorageUsageSnapshot | null): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(STORE_SYNC_STATE, "readwrite");
    snapshot
      ? transaction.objectStore(STORE_SYNC_STATE).put(snapshot, USAGE_KEY)
      : transaction.objectStore(STORE_SYNC_STATE).delete(USAGE_KEY);
    await idbTransactionComplete(transaction);
  }

  getStorageUsageSnapshot() { return this.read<StorageUsageSnapshot>(STORE_SYNC_STATE, USAGE_KEY); }

  putCachedAsset(asset: CachedAsset) { return this.put(STORE_ASSET_CACHE, asset); }

  async getCachedAsset(key: string): Promise<CachedAsset | null> {
    const asset = await this.read<CachedAsset>(STORE_ASSET_CACHE, key);
    if (asset) await this.put(STORE_ASSET_CACHE, { ...asset, lastAccessedAt: Date.now() });
    return asset;
  }

  async evictCachedAssets(maxBytes: number): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(STORE_ASSET_CACHE, "readwrite");
    const store = transaction.objectStore(STORE_ASSET_CACHE);
    const assets = await idbRequest<CachedAsset[]>(store.getAll());
    let total = assets.reduce((sum, asset) => sum + asset.byteLength, 0);
    for (const asset of assets.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)) {
      if (total <= maxBytes) break;
      store.delete(asset.key);
      total -= asset.byteLength;
    }
    await idbTransactionComplete(transaction);
  }

  async clearSyncData(): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction([STORE_SYNC_STATE, STORE_SYNC_OUTBOX, STORE_ASSET_CACHE], "readwrite");
    for (const name of [STORE_SYNC_STATE, STORE_SYNC_OUTBOX, STORE_ASSET_CACHE]) transaction.objectStore(name).clear();
    await idbTransactionComplete(transaction);
  }

  async repairSyncOutbox(snapshot: WorkspaceSnapshot): Promise<void> {
    const records: Array<[SyncRecordKey, number]> = [
      ["workspace", snapshot.manifest.revision],
      ["library", snapshot.library.revision],
      ...snapshot.encounters.map(({ id, revision }): [SyncRecordKey, number] => [`encounter:${id}`, revision])
    ];
    if (snapshot.recoveryDraft) records.push(["recovery_draft", snapshot.recoveryDraft.updatedAt]);
    for (const [key, revision] of records) {
      const baseline = await this.getSyncBaseline(key);
      if (!baseline || baseline.acknowledgedAt < revision) {
        await this.queueSyncOperation({
          key,
          operation: "upsert",
          mutationId: createMutationId(),
          localRevision: revision,
          expectedRemoteRevision: baseline?.remoteRevision ?? null,
          queuedAt: Date.now()
        });
      }
    }
  }

  async applyRemoteWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
    const db = await this.database();
    const transaction = db.transaction(
      [STORE_MANIFEST, STORE_ENCOUNTERS, STORE_RECOVERY, STORE_LIBRARY],
      "readwrite"
    );
    transaction.objectStore(STORE_MANIFEST).put(snapshot.manifest, MANIFEST_KEY);
    const encounters = transaction.objectStore(STORE_ENCOUNTERS);
    encounters.clear();
    for (const record of snapshot.encounters) encounters.put(record);
    const recovery = transaction.objectStore(STORE_RECOVERY);
    recovery.clear();
    if (snapshot.recoveryDraft) recovery.put(snapshot.recoveryDraft, RECOVERY_KEY);
    transaction.objectStore(STORE_LIBRARY).put(snapshot.library, LIBRARY_KEY);
    await idbTransactionComplete(transaction);
  }
}
