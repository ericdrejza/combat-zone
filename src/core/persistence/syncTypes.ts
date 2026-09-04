import type { WorkspaceSnapshot } from "./types";

export type SyncRecordKey =
  | "workspace"
  | "library"
  | "recovery_draft"
  | `encounter:${string}`;

export type SyncIdentity = {
  uid: string;
  connectedAt: number;
};

export type SyncBaseline = {
  key: SyncRecordKey;
  remoteRevision: number | null;
  snapshot: unknown | null;
  acknowledgedAt: number;
};

export type PendingSyncOperation = {
  key: SyncRecordKey;
  operation: "upsert" | "delete";
  mutationId: string;
  localRevision: number;
  expectedRemoteRevision: number | null;
  queuedAt: number;
};

export type RecentEncounterAccess = {
  encounterId: string;
  accessedAt: number;
};

export type StorageUsageSnapshot = {
  limitBytes: number;
  reservedBytes: number;
  storedBytes: number;
  updatedAt: number;
};

export type CachedAsset = {
  blob: Blob;
  byteLength: number;
  key: string;
  lastAccessedAt: number;
  version?: string;
};

export type LocalSyncRepository = {
  getSyncIdentity(): Promise<SyncIdentity | null>;
  setSyncIdentity(identity: SyncIdentity | null): Promise<void>;
  getSyncBaseline(key: SyncRecordKey): Promise<SyncBaseline | null>;
  setSyncBaseline(baseline: SyncBaseline): Promise<void>;
  listPendingSyncOperations(): Promise<PendingSyncOperation[]>;
  acknowledgeSyncOperation(key: SyncRecordKey, mutationId: string): Promise<void>;
  queueSyncOperation(operation: PendingSyncOperation): Promise<void>;
  recordRecentEncounterAccess(access: RecentEncounterAccess): Promise<void>;
  getRecentEncounterAccesses(): Promise<RecentEncounterAccess[]>;
  setStorageUsageSnapshot(snapshot: StorageUsageSnapshot | null): Promise<void>;
  getStorageUsageSnapshot(): Promise<StorageUsageSnapshot | null>;
  putCachedAsset(asset: CachedAsset): Promise<void>;
  getCachedAsset(key: string): Promise<CachedAsset | null>;
  evictCachedAssets(maxBytes: number): Promise<void>;
  clearSyncData(): Promise<void>;
  repairSyncOutbox(snapshot: WorkspaceSnapshot): Promise<void>;
  applyRemoteWorkspace(snapshot: WorkspaceSnapshot): Promise<void>;
};
