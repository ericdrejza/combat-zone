import { assertEncounterState, validateExportEnvelope } from "./envelope";
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from "./memoryRepository";
import {
  EXPORT_SCHEMA_VERSION,
  PersistenceValidationError,
  RevisionConflictError,
  WORKSPACE_SCHEMA_VERSION,
  type EncounterRecord,
  type EncounterExportEnvelope,
  type LibraryRecord,
  type RecoveryDraftRecord,
  type RepositorySaveOptions,
  type WorkspaceExportEnvelope,
  type WorkspaceManifest,
  type WorkspaceRepository
} from "./types";
import type { EncounterState } from "@core/encounter/types";
import type { LibraryState } from "@library/types";
import {
  idbRequest as request,
  idbTransactionComplete as transactionComplete,
  openWorkspaceDatabase as openDatabase,
  LIBRARY_KEY,
  LATEST_BACKUP_KEY,
  MANIFEST_KEY,
  RECOVERY_KEY,
  STORE_BACKUPS,
  STORE_ENCOUNTERS,
  STORE_LIBRARY,
  STORE_MANIFEST,
  STORE_RECOVERY,
  STORE_SYNC_OUTBOX,
  STORE_SYNC_STATE,
  STORE_ASSET_CACHE
} from "./indexedDbSchema";
import { journalSyncMutation } from "./indexedDbSyncRepository";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => Date.now();

export type IndexedDbWorkspaceRepositoryOptions = {
  databaseName?: string;
  databaseVersion?: number;
};

/** IndexedDB adapter. Transactions are kept inside this boundary so callers never handle IDB requests. */
export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private readonly databaseName: string;
  private readonly databaseVersion: number;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDbWorkspaceRepositoryOptions = {}) {
    this.databaseName = options.databaseName ?? "combat-zone";
    this.databaseVersion = options.databaseVersion ?? 4;
  }

  private database(): Promise<IDBDatabase> {
    return (this.databasePromise ??= openDatabase(this.databaseName, this.databaseVersion));
  }

  private async read<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    const database = await this.database();
    const transaction = database.transaction(store, "readonly");
    const result = await request(transaction.objectStore(store).get(key));
    await transactionComplete(transaction);
    return result as T | undefined;
  }

  private async write<T>(stores: string | string[], operation: (transaction: IDBTransaction) => Promise<T>): Promise<T> {
    const database = await this.database();
    const transaction = database.transaction(stores, "readwrite");
    const result = await operation(transaction);
    await transactionComplete(transaction);
    return result;
  }

  async initialize(): Promise<WorkspaceManifest> {
    const manifest = await this.read<WorkspaceManifest>(STORE_MANIFEST, MANIFEST_KEY);
    if (manifest) return clone(manifest);
    const timestamp = now();
    const initial: WorkspaceManifest = { schemaVersion: WORKSPACE_SCHEMA_VERSION, activeEncounterId: null, revision: 0, updatedAt: timestamp };
    await this.write([STORE_MANIFEST, STORE_LIBRARY], async (transaction) => {
      transaction.objectStore(STORE_MANIFEST).put(initial, MANIFEST_KEY);
      transaction.objectStore(STORE_LIBRARY).put({ state: createEmptyLibraryState(), revision: 0, updatedAt: timestamp } satisfies LibraryRecord, LIBRARY_KEY);
      return undefined;
    });
    return clone(initial);
  }

  async getManifest(): Promise<WorkspaceManifest> { return clone((await this.read<WorkspaceManifest>(STORE_MANIFEST, MANIFEST_KEY)) ?? (await this.initialize())); }

  async saveManifest(manifest: WorkspaceManifest): Promise<WorkspaceManifest> {
    if (manifest.schemaVersion !== WORKSPACE_SCHEMA_VERSION || manifest.revision < 0) throw new PersistenceValidationError("Invalid workspace manifest.");
    await this.write(STORE_MANIFEST, async (transaction) => { transaction.objectStore(STORE_MANIFEST).put(clone(manifest), MANIFEST_KEY); return undefined; });
    return clone(manifest);
  }

  async createEncounter(state: EncounterState, folderId: string | null = null): Promise<EncounterRecord> {
    assertEncounterState(state);
    if (
      folderId !== null &&
      (await this.getLibrary()).state.sections.encounters.nodesById[folderId]?.type !==
        "folder"
    ) {
      throw new PersistenceValidationError(`Encounter folder ${folderId} does not exist.`);
    }
    const existing = await this.getEncounter(state.id);
    if (existing) throw new PersistenceValidationError(`Encounter ${state.id} already exists.`);
    const timestamp = now();
    const record: EncounterRecord = { id: state.id, state: clone(state), folderId, revision: 0, createdAt: timestamp, updatedAt: timestamp };
    await this.write([STORE_ENCOUNTERS, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_ENCOUNTERS).add(record);
      await journalSyncMutation(transaction, `encounter:${record.id}`, record.revision, "upsert");
      return undefined;
    });
    return clone(record);
  }

  async listEncounters(): Promise<EncounterRecord[]> {
    const database = await this.database();
    const transaction = database.transaction(STORE_ENCOUNTERS, "readonly");
    const records = await request(transaction.objectStore(STORE_ENCOUNTERS).getAll());
    await transactionComplete(transaction);
    return (records as EncounterRecord[]).sort((a, b) => a.updatedAt - b.updatedAt).map(clone);
  }

  async getEncounter(id: string): Promise<EncounterRecord | null> { return clone((await this.read<EncounterRecord>(STORE_ENCOUNTERS, id)) ?? null); }

  async saveEncounter(state: EncounterState, options: RepositorySaveOptions = {}): Promise<EncounterRecord> {
    assertEncounterState(state);
    const database = await this.database();
    const transaction = database.transaction([STORE_ENCOUNTERS, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], "readwrite");
    const store = transaction.objectStore(STORE_ENCOUNTERS);
    const existing = (await request(store.get(state.id))) as EncounterRecord | undefined;
    if (!existing) {
      transaction.abort();
      throw new PersistenceValidationError(`Encounter ${state.id} does not exist.`);
    }
    const expected = options.expectedRevision ?? existing.revision;
    if (expected !== existing.revision) {
      transaction.abort();
      throw new RevisionConflictError(state.id, expected, existing.revision);
    }
    const record: EncounterRecord = { ...existing, state: clone(state), folderId: options.folderId === undefined ? existing.folderId : options.folderId, revision: existing.revision + 1, updatedAt: now() };
    store.put(record);
    await journalSyncMutation(transaction, `encounter:${record.id}`, record.revision, "upsert");
    await transactionComplete(transaction);
    return clone(record);
  }

  async duplicateEncounter(id: string, newId?: string): Promise<EncounterRecord> {
    const source = await this.getEncounter(id);
    if (!source) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    const ids = new Set((await this.listEncounters()).map((record) => record.id));
    let targetId = newId ?? `${id}-copy`;
    let suffix = 2;
    while (ids.has(targetId)) targetId = `${id}-copy-${suffix++}`;
    return this.createEncounter({ ...source.state, id: targetId }, source.folderId);
  }

  async moveEncounter(id: string, folderId: string | null): Promise<EncounterRecord> {
    const source = await this.getEncounter(id);
    if (!source) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    if (
      folderId !== null &&
      (await this.getLibrary()).state.sections.encounters.nodesById[folderId]?.type !==
        "folder"
    ) {
      throw new PersistenceValidationError(`Encounter folder ${folderId} does not exist.`);
    }
    const record = { ...source, folderId, revision: source.revision + 1, updatedAt: now() };
    await this.write([STORE_ENCOUNTERS, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_ENCOUNTERS).put(record);
      await journalSyncMutation(transaction, `encounter:${record.id}`, record.revision, "upsert");
      return undefined;
    });
    return clone(record);
  }

  async deleteEncounter(id: string): Promise<void> {
    const manifest = await this.getManifest();
    await this.write([STORE_ENCOUNTERS, STORE_MANIFEST, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_ENCOUNTERS).delete(id);
      if (manifest.activeEncounterId === id) transaction.objectStore(STORE_MANIFEST).put({ ...manifest, activeEncounterId: null, revision: manifest.revision + 1, updatedAt: now() }, MANIFEST_KEY);
      await journalSyncMutation(transaction, `encounter:${id}`, now(), "delete");
      return undefined;
    });
  }

  async getRecoveryDraft(): Promise<RecoveryDraftRecord | null> { return clone((await this.read<RecoveryDraftRecord>(STORE_RECOVERY, RECOVERY_KEY)) ?? null); }

  async saveRecoveryDraft(state: EncounterState): Promise<RecoveryDraftRecord> {
    assertEncounterState(state);
    const record: RecoveryDraftRecord = { state: clone(state), updatedAt: now() };
    await this.write([STORE_RECOVERY, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_RECOVERY).put(record, RECOVERY_KEY);
      await journalSyncMutation(transaction, "recovery_draft", record.updatedAt, "upsert");
      return undefined;
    });
    return clone(record);
  }

  async deleteRecoveryDraft(): Promise<void> {
    await this.write([STORE_RECOVERY, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_RECOVERY).delete(RECOVERY_KEY);
      await journalSyncMutation(transaction, "recovery_draft", now(), "delete");
      return undefined;
    });
  }

  async getLibrary(): Promise<LibraryRecord> { return clone((await this.read<LibraryRecord>(STORE_LIBRARY, LIBRARY_KEY)) ?? { state: createEmptyLibraryState(), revision: 0, updatedAt: now() }); }

  async saveLibrary(state: LibraryState): Promise<LibraryRecord> {
    const previous = await this.getLibrary();
    const record: LibraryRecord = { state: clone(state), revision: previous.revision + 1, updatedAt: now() };
    await this.write([STORE_LIBRARY, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      transaction.objectStore(STORE_LIBRARY).put(record, LIBRARY_KEY);
      await journalSyncMutation(transaction, "library", record.revision, "upsert");
      return undefined;
    });
    return clone(record);
  }

  private async snapshot() {
    const [manifest, encounters, recoveryDraft, library] = await Promise.all([this.getManifest(), this.listEncounters(), this.getRecoveryDraft(), this.getLibrary()]);
    return { manifest, encounters, recoveryDraft, library };
  }

  async exportWorkspace(): Promise<WorkspaceExportEnvelope> {
    return validateExportEnvelope({ kind: "workspace-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now(), workspace: await this.snapshot() }) as WorkspaceExportEnvelope;
  }

  async exportEncounter(id: string): Promise<EncounterExportEnvelope> {
    const record = await this.getEncounter(id);
    if (!record) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    return validateExportEnvelope({ kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now(), encounter: record.state, library: (await this.getLibrary()).state }) as EncounterExportEnvelope;
  }

  async importWorkspace(envelope: WorkspaceExportEnvelope, mode: "overwrite" | "merge"): Promise<WorkspaceManifest> {
    validateExportEnvelope(envelope);
    // Computing the merge through the same in-memory implementation keeps ID and
    // revision semantics identical across repository adapters.
    const current = await this.snapshot();
    const memory = new InMemoryWorkspaceRepository();
    await memory.importWorkspace({ kind: "workspace-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now(), workspace: current }, "overwrite");
    const nextManifest = await memory.importWorkspace(envelope, mode);
    const next = await memory.exportWorkspace();
    const existing = mode === "overwrite" ? await this.listEncounters() : [];
    await this.write([STORE_MANIFEST, STORE_ENCOUNTERS, STORE_RECOVERY, STORE_LIBRARY, STORE_SYNC_STATE, STORE_SYNC_OUTBOX], async (transaction) => {
      const encounters = transaction.objectStore(STORE_ENCOUNTERS);
      if (mode === "overwrite") for (const record of existing as EncounterRecord[]) encounters.delete(record.id);
      for (const record of next.workspace.encounters) encounters.put(record);
      const manifestStore = transaction.objectStore(STORE_MANIFEST);
      manifestStore.put(next.workspace.manifest, MANIFEST_KEY);
      const recoveryStore = transaction.objectStore(STORE_RECOVERY);
      recoveryStore.delete(RECOVERY_KEY);
      if (next.workspace.recoveryDraft) recoveryStore.put(next.workspace.recoveryDraft, RECOVERY_KEY);
      transaction.objectStore(STORE_LIBRARY).put(next.workspace.library, LIBRARY_KEY);
      const nextIds = new Set(next.workspace.encounters.map(({ id }) => id));
      for (const record of next.workspace.encounters) {
        await journalSyncMutation(transaction, `encounter:${record.id}`, record.revision, "upsert");
      }
      for (const record of existing) {
        if (!nextIds.has(record.id)) await journalSyncMutation(transaction, `encounter:${record.id}`, now(), "delete");
      }
      await journalSyncMutation(transaction, "library", next.workspace.library.revision, "upsert");
      await journalSyncMutation(transaction, "recovery_draft", next.workspace.recoveryDraft?.updatedAt ?? now(), next.workspace.recoveryDraft ? "upsert" : "delete");
      return undefined;
    });
    return clone(nextManifest);
  }

  async saveBackup(envelope: WorkspaceExportEnvelope): Promise<void> {
    validateExportEnvelope(envelope);
    await this.write(STORE_BACKUPS, async (transaction) => {
      transaction.objectStore(STORE_BACKUPS).put(clone(envelope), LATEST_BACKUP_KEY);
      return undefined;
    });
  }

  async getLatestBackup(): Promise<WorkspaceExportEnvelope | null> {
    return clone(
      (await this.read<WorkspaceExportEnvelope>(
        STORE_BACKUPS,
        LATEST_BACKUP_KEY
      )) ?? null
    );
  }

  async clearLocalData(): Promise<void> {
    await this.write(
      [
        STORE_MANIFEST,
        STORE_ENCOUNTERS,
        STORE_RECOVERY,
        STORE_LIBRARY,
        STORE_BACKUPS,
        STORE_SYNC_STATE,
        STORE_SYNC_OUTBOX,
        STORE_ASSET_CACHE
      ],
      async (transaction) => {
        for (const storeName of [
          STORE_MANIFEST,
          STORE_ENCOUNTERS,
          STORE_RECOVERY,
          STORE_LIBRARY,
          STORE_BACKUPS,
          STORE_SYNC_STATE,
          STORE_SYNC_OUTBOX,
          STORE_ASSET_CACHE
        ]) {
          transaction.objectStore(storeName).clear();
        }
        return undefined;
      }
    );
  }
}
