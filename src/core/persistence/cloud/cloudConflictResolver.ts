import { CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";
import type { EncounterRecord, LibraryRecord, WorkspaceRepository, WorkspaceSnapshot } from "../types";
import type { LocalSyncRepository, PendingSyncOperation, RecentEncounterAccess } from "../syncTypes";
import { parseCloudWorkspace } from "./cloudRecords";
import type { CloudWorkspaceRepository, CloudWorkspaceSnapshot } from "./cloudWorkspaceRepository";
import { mergeLibraryStates } from "./libraryConflictMerge";

type ConflictOptions = {
  cloud: CloudWorkspaceRepository;
  local: WorkspaceRepository;
  sync: LocalSyncRepository;
  onRemoteApplied?: () => Promise<void>;
};

const revision = (value: unknown): number | null => {
  const result = (value as { revision?: unknown } | null)?.revision;
  return typeof result === "number" ? result : null;
};

function conflictName(name: string, used: Set<string>): string {
  const base = `${name} (Conflict copy)`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base} ${suffix++}`;
  return candidate;
}

function conflictId(id: string, used: Set<string>): string {
  let candidate = `${id}-conflict`;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${id}-conflict-${suffix++}`;
  return candidate;
}

const mutationId = () => globalThis.crypto?.randomUUID?.() ?? `mutation-${Date.now()}-${Math.random()}`;

async function createConflictEncounter(
  source: EncounterRecord["state"],
  folderId: string | null,
  options: ConflictOptions
): Promise<EncounterRecord> {
  const existing = await options.local.listEncounters();
  const id = conflictId(source.id, new Set(existing.map((item) => item.id)));
  const name = conflictName(source.name, new Set(existing.map((item) => item.state.name)));
  return options.local.createEncounter({ ...structuredClone(source), id, name }, folderId);
}

async function applySnapshot(snapshot: WorkspaceSnapshot, options: ConflictOptions) {
  await options.sync.applyRemoteWorkspace(snapshot);
  await options.onRemoteApplied?.();
}

function rawEncounter(snapshot: CloudWorkspaceSnapshot, id: string): unknown | null {
  return snapshot.encounters.find((item) => (item as { encounterId?: unknown }).encounterId === id) ?? null;
}

/** Converts revision failures into deterministic, lossless local operations. */
export async function resolveCloudRevisionConflict(
  operation: PendingSyncOperation,
  options: ConflictOptions
): Promise<boolean> {
  const source = await options.cloud.readWorkspace();
  if (!source) return false;
  const remote = parseCloudWorkspace(source);
  const local = (await options.local.exportWorkspace()).workspace;

  if (operation.key.startsWith("encounter:")) {
    const id = operation.key.slice("encounter:".length);
    const remoteRecord = remote.encounters.find((item) => item.id === id);
    const actualRevision = revision(rawEncounter(source, id));
    if (actualRevision === null) return false;
    if (!remoteRecord) {
      if (operation.operation === "upsert") {
        const localRecord = local.encounters.find((item) => item.id === id);
        if (localRecord) await createConflictEncounter(localRecord.state, localRecord.folderId, options);
        const withConflict = (await options.local.exportWorkspace()).workspace;
        await applySnapshot({ ...withConflict, encounters: withConflict.encounters.filter((item) => item.id !== id) }, options);
      }
      await options.sync.setSyncBaseline({ key: operation.key, remoteRevision: actualRevision, snapshot: null, acknowledgedAt: operation.localRevision });
      await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
      return true;
    }
    if (operation.operation === "delete") {
      await createConflictEncounter(remoteRecord.state, remoteRecord.folderId, options);
      await options.sync.setSyncBaseline({ key: operation.key, remoteRevision: actualRevision, snapshot: remoteRecord, acknowledgedAt: operation.localRevision });
      await options.sync.queueSyncOperation({ ...operation, expectedRemoteRevision: actualRevision, mutationId: mutationId(), queuedAt: Date.now() });
      return true;
    }
    const localRecord = local.encounters.find((item) => item.id === id);
    if (!localRecord) return false;
    await createConflictEncounter(localRecord.state, localRecord.folderId, options);
    const withConflict = (await options.local.exportWorkspace()).workspace;
    await applySnapshot({
      ...withConflict,
      encounters: [...withConflict.encounters.filter((item) => item.id !== id), remoteRecord]
    }, options);
    await options.sync.setSyncBaseline({ key: operation.key, remoteRevision: actualRevision, snapshot: remoteRecord, acknowledgedAt: remoteRecord.revision });
    await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
    return true;
  }

  if (operation.key === "library") {
    const actualRevision = revision(source.library);
    const baseline = await options.sync.getSyncBaseline("library");
    const base = (baseline?.snapshot as LibraryRecord | null)?.state;
    if (actualRevision === null || !base) return false;
    const merged = mergeLibraryStates(base, local.library.state, remote.library.state);
    await options.sync.setSyncBaseline({ key: "library", remoteRevision: actualRevision, snapshot: remote.library, acknowledgedAt: remote.library.revision });
    await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
    await options.local.saveLibrary(merged.state);
    for (const encounter of local.encounters) {
      const folderId = encounter.folderId ? merged.localConflictIds.get(encounter.folderId) : null;
      if (folderId) await options.local.moveEncounter(encounter.id, folderId);
    }
    return true;
  }

  if (operation.key === "recovery_draft") {
    const actualRevision = revision(source.recoveryDraft);
    if (actualRevision === null) return false;
    const localDraft = local.recoveryDraft;
    const remoteDraft = remote.recoveryDraft;
    if (localDraft && remoteDraft) {
      const localWins = localDraft.updatedAt >= remoteDraft.updatedAt;
      await createConflictEncounter((localWins ? remoteDraft : localDraft).state, null, options);
      await options.sync.setSyncBaseline({ key: "recovery_draft", remoteRevision: actualRevision, snapshot: remoteDraft, acknowledgedAt: remoteDraft.updatedAt });
      await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
      if (localWins) {
        await options.sync.queueSyncOperation({ ...operation, expectedRemoteRevision: actualRevision, mutationId: mutationId(), queuedAt: Date.now() });
      } else {
        const withConflict = (await options.local.exportWorkspace()).workspace;
        await applySnapshot({ ...withConflict, recoveryDraft: remoteDraft }, options);
      }
      return true;
    }
    if (localDraft && !remoteDraft) {
      await createConflictEncounter(localDraft.state, null, options);
      const withConflict = (await options.local.exportWorkspace()).workspace;
      await applySnapshot({ ...withConflict, recoveryDraft: null }, options);
      await options.sync.setSyncBaseline({ key: "recovery_draft", remoteRevision: actualRevision, snapshot: null, acknowledgedAt: operation.localRevision });
      await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
      return true;
    }
    if (!localDraft && remoteDraft) {
      await createConflictEncounter(remoteDraft.state, null, options);
      await options.sync.setSyncBaseline({ key: "recovery_draft", remoteRevision: actualRevision, snapshot: remoteDraft, acknowledgedAt: operation.localRevision });
      await options.sync.queueSyncOperation({ ...operation, expectedRemoteRevision: actualRevision, mutationId: mutationId(), queuedAt: Date.now() });
      return true;
    }
    return false;
  }

  const actualRevision = revision(source.workspace);
  if (actualRevision === null) return false;
  const remoteRecent = ((source.workspace as { recentEncounters?: unknown }).recentEncounters ?? []) as RecentEncounterAccess[];
  await options.sync.setSyncBaseline({ key: "workspace", remoteRevision: actualRevision, snapshot: remote.manifest, acknowledgedAt: local.manifest.revision });
  await options.sync.acknowledgeSyncOperation(operation.key, operation.mutationId);
  for (const item of remoteRecent) {
    if (item && typeof item.encounterId === "string" && typeof item.accessedAt === "number") {
      await options.sync.recordRecentEncounterAccess(item);
    }
  }
  return true;
}
