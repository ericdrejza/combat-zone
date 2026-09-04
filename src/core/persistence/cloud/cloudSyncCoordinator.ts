import {
  CLOUD_RECORD_SCHEMA_VERSION,
  FIREBASE_API_VERSION,
  type CloudCommand,
  type ReplaceWorkspacePayload
} from "@combat-zone/firebase-api";
import type { LocalSyncRepository, PendingSyncOperation, SyncRecordKey } from "../syncTypes";
import { EXPORT_SCHEMA_VERSION, type WorkspaceExportEnvelope, type WorkspaceRepository, type WorkspaceSnapshot } from "../types";
import type { CloudAssetRepository } from "./cloudAssetRepository";
import { parseCloudWorkspace } from "./cloudRecords";
import { draftPayload, encounterPayload, libraryPayload } from "./cloudSerialization";
import type { CloudWorkspaceRepository, CloudWorkspaceSnapshot } from "./cloudWorkspaceRepository";
import { FirebaseApiClientError, withFirebaseApiRetry } from "./firebaseApiError";
import { resolveCloudRevisionConflict } from "./cloudConflictResolver";

export type CloudSyncStatus = "unavailable" | "signedOut" | "authenticating" | "entitlementRequired" | "reconciling" | "syncing" | "synced" | "offline" | "error";
export type ReconciliationChoice = "merge" | "use_cloud" | "keep_device";

type CoordinatorOptions = {
  cloud: CloudWorkspaceRepository;
  assets: CloudAssetRepository;
  local: WorkspaceRepository;
  sync: LocalSyncRepository;
  uid: string;
  onStatus: (status: CloudSyncStatus, error?: Error) => void;
  exportLocal?: () => Promise<WorkspaceExportEnvelope>;
  importLocal?: (value: WorkspaceExportEnvelope, mode: "merge" | "overwrite") => Promise<void>;
  onRemoteApplied?: () => Promise<void>;
};

function command<T>(payload: T, expectedRevision: number | null, mutationId: string = globalThis.crypto?.randomUUID?.() ?? `mutation-${Date.now()}-${Math.random()}`): CloudCommand<T> {
  return { apiVersion: FIREBASE_API_VERSION, expectedRevision, mutationId, payload };
}

function envelope(snapshot: WorkspaceSnapshot): WorkspaceExportEnvelope {
  return { kind: "workspace-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: Date.now(), workspace: snapshot };
}

function remoteRevision(value: unknown): number | null {
  const revision = (value as { revision?: unknown } | null)?.revision;
  return typeof revision === "number" ? revision : null;
}

/** Coordinates durable local operations without exposing Firebase to Redux or UI. */
export class CloudSyncCoordinator {
  private pendingRemote: CloudWorkspaceSnapshot | null = null;
  private unsubscribe: (() => void) | null = null;
  private running = false;
  private pulling = false;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: CoordinatorOptions) {}

  async start(): Promise<"ready" | "reconciliation_required"> {
    const previousIdentity = await this.options.sync.getSyncIdentity();
    if (previousIdentity && previousIdentity.uid !== this.options.uid) {
      await this.options.sync.clearSyncData();
    }
    await this.options.sync.setSyncIdentity({ uid: this.options.uid, connectedAt: Date.now() });
    const localEnvelope = await this.exportLocal();
    await this.options.sync.repairSyncOutbox(localEnvelope.workspace);
    const remote = await this.options.cloud.readWorkspace();
    if (!remote) {
      this.options.onStatus("syncing");
      const replacement = await this.replaceRemote(localEnvelope.workspace, null);
      await this.markSnapshotAcknowledged(localEnvelope.workspace, replacement.revision);
      this.listen();
      this.options.onStatus("synced");
      return "ready";
    }
    const baseline = await this.options.sync.getSyncBaseline("workspace");
    if (!baseline) {
      this.pendingRemote = remote;
      this.options.onStatus("reconciling");
      return "reconciliation_required";
    }
    this.listen();
    await this.synchronize();
    return "ready";
  }

  async reconcile(choice: ReconciliationChoice): Promise<void> {
    if (!this.pendingRemote) throw new Error("No cloud workspace is awaiting reconciliation.");
    this.options.onStatus("reconciling");
    const remote = parseCloudWorkspace(this.pendingRemote);
    if (choice === "use_cloud") {
      await this.options.local.saveBackup(await this.exportLocal());
      await this.importLocal(envelope(remote), "overwrite");
    } else if (choice === "merge") {
      await this.importLocal(envelope(remote), "merge");
      await this.replaceRemote((await this.exportLocal()).workspace, remote.manifest.revision);
    } else {
      await this.options.local.saveBackup(envelope(remote));
      await this.replaceRemote((await this.exportLocal()).workspace, remote.manifest.revision);
    }
    const current = (await this.exportLocal()).workspace;
    const refreshed = await this.options.cloud.readWorkspace();
    await this.markSnapshotAcknowledged(current, refreshed ? remoteRevision(refreshed.workspace) ?? 1 : 1);
    this.pendingRemote = null;
    this.listen();
    this.options.onStatus("synced");
  }

  async drain(): Promise<void> {
    const online = typeof navigator === "undefined" || navigator.onLine;
    if (this.running || !online) {
      if (!online) this.options.onStatus("offline");
      return;
    }
    this.running = true;
    this.options.onStatus("syncing");
    try {
      for (const operation of await this.options.sync.listPendingSyncOperations()) {
        try {
          await this.push(operation);
        } catch (error) {
          if (!(error instanceof FirebaseApiClientError) || error.code !== "REVISION_CONFLICT") throw error;
          const resolved = await resolveCloudRevisionConflict(operation, this.options);
          if (!resolved) throw error;
        }
      }
      this.options.onStatus("synced");
    } catch (error) {
      this.options.onStatus(error instanceof FirebaseApiClientError && error.retryable ? "offline" : "error", error as Error);
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.pullTimer) clearTimeout(this.pullTimer);
    this.pullTimer = null;
  }

  private listen(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.options.cloud.subscribeWorkspace(
      () => {
        if (this.pullTimer) clearTimeout(this.pullTimer);
        this.pullTimer = setTimeout(() => void this.synchronize(), 75);
      },
      (error) => this.options.onStatus("error", error)
    );
  }

  private async synchronize(): Promise<void> {
    await this.drain();
    await this.pullRemote();
  }

  private async pullRemote(): Promise<void> {
    if (this.pulling || this.running) return;
    this.pulling = true;
    try {
      const value = await this.options.cloud.readWorkspace();
      if (!value) return;
      const remote = parseCloudWorkspace(value);
      const local = (await this.exportLocal()).workspace;
      const remoteIds = new Set(remote.encounters.map(({ id }) => id));
      const remoteRecent = (value.workspace as { recentEncounters?: unknown }).recentEncounters;
      if (Array.isArray(remoteRecent)) {
        for (const item of remoteRecent) {
          const access = item as { accessedAt?: unknown; encounterId?: unknown };
          if (typeof access.encounterId === "string" && typeof access.accessedAt === "number" && remoteIds.has(access.encounterId)) {
            await this.options.sync.recordRecentEncounterAccess({ encounterId: access.encounterId, accessedAt: access.accessedAt });
          }
        }
      }
      const pending = new Map((await this.options.sync.listPendingSyncOperations()).map((item) => [item.key, item]));
      const localById = new Map(local.encounters.map((record) => [record.id, record]));
      const remoteById = new Map(remote.encounters.map((record) => [record.id, record]));
      const mergedEncounters = remote.encounters.filter((record) => !pending.has(`encounter:${record.id}`));
      for (const [id, record] of localById) {
        if (pending.get(`encounter:${id}`)?.operation === "upsert") mergedEncounters.push(record);
        else if (!remoteById.has(id) && pending.has(`encounter:${id}`)) continue;
      }
      const next: WorkspaceSnapshot = {
        ...remote,
        manifest: { ...remote.manifest, activeEncounterId: local.manifest.activeEncounterId },
        encounters: mergedEncounters,
        library: pending.has("library") ? local.library : remote.library,
        recoveryDraft: pending.has("recovery_draft") ? local.recoveryDraft : remote.recoveryDraft
      };
      const changed = JSON.stringify(next) !== JSON.stringify(local);
      if (changed) {
        await this.options.sync.applyRemoteWorkspace(next);
        await this.options.onRemoteApplied?.();
      }
      await this.acknowledgeRemote(value, next, pending);
      if (!pending.size) this.options.onStatus("synced");
    } catch (error) {
      this.options.onStatus("error", error as Error);
    } finally {
      this.pulling = false;
    }
  }

  private async push(operation: PendingSyncOperation): Promise<void> {
    const expected = operation.expectedRemoteRevision;
    let result;
    if (operation.key.startsWith("encounter:")) {
      const id = operation.key.slice("encounter:".length);
      if (operation.operation === "delete") {
        result = await withFirebaseApiRetry(() => this.options.cloud.deleteEncounter(command({ encounterId: id, schemaVersion: CLOUD_RECORD_SCHEMA_VERSION }, expected, operation.mutationId)));
      } else {
        const record = await this.options.local.getEncounter(id);
        if (!record) return;
        result = await withFirebaseApiRetry(() => encounterPayload(record, this.options.assets).then((payload) => this.options.cloud.commitEncounter(command(payload, expected, operation.mutationId))));
      }
    } else if (operation.key === "library") {
      const record = await this.options.local.getLibrary();
      result = await withFirebaseApiRetry(() => libraryPayload(record, this.options.assets).then((payload) => this.options.cloud.commitLibrary(command(payload, expected, operation.mutationId))));
    } else if (operation.key === "recovery_draft") {
      const record = await this.options.local.getRecoveryDraft();
      result = await withFirebaseApiRetry(() => draftPayload(record, this.options.assets).then((payload) => this.options.cloud.commitRecoveryDraft(command(payload, expected, operation.mutationId))));
    } else {
      const recentEncounters = await this.options.sync.getRecentEncounterAccesses();
      result = await withFirebaseApiRetry(() => this.options.cloud.commitWorkspace(command({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, recentEncounters }, expected, operation.mutationId)));
    }
    await this.options.sync.setSyncBaseline({ key: operation.key, remoteRevision: result.revision, snapshot: await this.localRecord(operation.key), acknowledgedAt: operation.localRevision });
    await this.options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
  }

  private async localRecord(key: SyncRecordKey): Promise<unknown> {
    if (key === "library") return this.options.local.getLibrary();
    if (key === "recovery_draft") return this.options.local.getRecoveryDraft();
    if (key.startsWith("encounter:")) return this.options.local.getEncounter(key.slice(10));
    return this.options.local.getManifest();
  }

  private async replaceRemote(snapshot: WorkspaceSnapshot, expectedRevision: number | null) {
    const payload: ReplaceWorkspacePayload = {
      workspace: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, recentEncounters: await this.options.sync.getRecentEncounterAccesses() },
      encounters: await Promise.all(snapshot.encounters.map((record) => encounterPayload(record, this.options.assets))),
      library: await libraryPayload(snapshot.library, this.options.assets),
      recoveryDraft: await draftPayload(snapshot.recoveryDraft, this.options.assets)
    };
    return withFirebaseApiRetry(() => this.options.cloud.replaceWorkspace(command(payload, expectedRevision)));
  }

  private async markSnapshotAcknowledged(snapshot: WorkspaceSnapshot, workspaceRemoteRevision: number): Promise<void> {
    const revisions: Array<[SyncRecordKey, number, unknown]> = [
      ["workspace", snapshot.manifest.revision, snapshot.manifest],
      ["library", snapshot.library.revision, snapshot.library],
      ...snapshot.encounters.map((record): [SyncRecordKey, number, unknown] => [`encounter:${record.id}`, record.revision, record])
    ];
    if (snapshot.recoveryDraft) revisions.push(["recovery_draft", snapshot.recoveryDraft.updatedAt, snapshot.recoveryDraft]);
    for (const [key, revision, value] of revisions) {
      await this.options.sync.setSyncBaseline({ key, remoteRevision: key === "workspace" ? workspaceRemoteRevision : 1, snapshot: value, acknowledgedAt: revision });
    }
    for (const operation of await this.options.sync.listPendingSyncOperations()) {
      await this.options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
    }
  }

  private async acknowledgeRemote(
    source: CloudWorkspaceSnapshot,
    snapshot: WorkspaceSnapshot,
    pending: Map<SyncRecordKey, PendingSyncOperation>
  ): Promise<void> {
    const records: Array<[SyncRecordKey, number | null, unknown, number]> = [
      ["workspace", remoteRevision(source.workspace), snapshot.manifest, snapshot.manifest.revision],
      ["library", remoteRevision(source.library), snapshot.library, snapshot.library.revision]
    ];
    const rawEncounters = new Map(source.encounters.map((item) => [String((item as { encounterId?: unknown }).encounterId), item]));
    for (const record of snapshot.encounters) {
      records.push([`encounter:${record.id}`, remoteRevision(rawEncounters.get(record.id)), record, record.revision]);
    }
    for (const [id, raw] of rawEncounters) {
      if (snapshot.encounters.some((record) => record.id === id)) continue;
      const rawValue = raw as { deleted?: unknown; updatedAt?: unknown };
      if (rawValue.deleted === true) {
        const updatedAt = typeof rawValue.updatedAt === "number"
          ? rawValue.updatedAt
          : (rawValue.updatedAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
        records.push([`encounter:${id}`, remoteRevision(raw), null, updatedAt]);
      }
    }
    records.push(["recovery_draft", remoteRevision(source.recoveryDraft), snapshot.recoveryDraft, snapshot.recoveryDraft?.updatedAt ?? 0]);
    for (const [key, revision, value, localRevision] of records) {
      if (pending.has(key) || revision === null) continue;
      await this.options.sync.setSyncBaseline({ key, remoteRevision: revision, snapshot: value, acknowledgedAt: localRevision });
    }
  }

  private exportLocal(): Promise<WorkspaceExportEnvelope> {
    return this.options.exportLocal?.() ?? this.options.local.exportWorkspace();
  }

  private importLocal(value: WorkspaceExportEnvelope, mode: "merge" | "overwrite"): Promise<void> {
    return this.options.importLocal?.(value, mode) ?? this.options.local.importWorkspace(value, mode).then(() => undefined);
  }
}
