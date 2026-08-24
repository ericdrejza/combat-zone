import { assertEncounterState, validateExportEnvelope } from "./envelope";
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
  type WorkspaceRepository,
  type WorkspaceSnapshot
} from "./types";
import type { EncounterState } from "@core/encounter/types";
import type { LibraryState } from "@library/types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createEmptyLibraryState(): LibraryState {
  const labels = { encounters: "Encounters", backgrounds: "Backgrounds", tokens: "Tokens" } as const;
  const sections = Object.fromEntries(
    (Object.keys(labels) as Array<keyof typeof labels>).map((id) => {
      const rootId = `${id}-root`;
      return [id, { id, name: labels[id], rootId, nodesById: {
        [rootId]: { id: rootId, name: labels[id], parentId: null, sectionId: id, type: "folder", childIds: [] }
      }}];
    })
  ) as unknown as LibraryState["sections"];
  return { sections };
}

function now(): number {
  return Date.now();
}

function createManifest(timestamp = now()): WorkspaceManifest {
  return { schemaVersion: WORKSPACE_SCHEMA_VERSION, activeEncounterId: null, revision: 0, updatedAt: timestamp };
}

function nextId(base: string, used: Set<string>): string {
  let candidate = `${base}-copy`;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-copy-${suffix++}`;
  return candidate;
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private manifest: WorkspaceManifest | null = null;
  private readonly encounters = new Map<string, EncounterRecord>();
  private recoveryDraft: RecoveryDraftRecord | null = null;
  private latestBackup: WorkspaceExportEnvelope | null = null;
  private library: LibraryRecord = { state: createEmptyLibraryState(), revision: 0, updatedAt: now() };

  async initialize(): Promise<WorkspaceManifest> {
    if (!this.manifest) this.manifest = createManifest();
    return clone(this.manifest);
  }

  private async ready(): Promise<void> { await this.initialize(); }

  async getManifest(): Promise<WorkspaceManifest> {
    await this.ready();
    return clone(this.manifest as WorkspaceManifest);
  }

  async saveManifest(manifest: WorkspaceManifest): Promise<WorkspaceManifest> {
    if (manifest.schemaVersion !== WORKSPACE_SCHEMA_VERSION || manifest.revision < 0) {
      throw new PersistenceValidationError("Invalid workspace manifest.");
    }
    this.manifest = clone(manifest);
    return clone(manifest);
  }

  async createEncounter(state: EncounterState, folderId: string | null = null): Promise<EncounterRecord> {
    await this.ready();
    assertEncounterState(state);
    if (
      folderId !== null &&
      this.library.state.sections.encounters.nodesById[folderId]?.type !== "folder"
    ) {
      throw new PersistenceValidationError(`Encounter folder ${folderId} does not exist.`);
    }
    if (this.encounters.has(state.id)) throw new PersistenceValidationError(`Encounter ${state.id} already exists.`);
    const timestamp = now();
    const record: EncounterRecord = { id: state.id, state: clone(state), folderId, revision: 0, createdAt: timestamp, updatedAt: timestamp };
    this.encounters.set(record.id, record);
    return clone(record);
  }

  async listEncounters(): Promise<EncounterRecord[]> {
    await this.ready();
    return [...this.encounters.values()].sort((a, b) => a.updatedAt - b.updatedAt).map(clone);
  }

  async getEncounter(id: string): Promise<EncounterRecord | null> {
    await this.ready();
    return clone(this.encounters.get(id) ?? null);
  }

  async saveEncounter(state: EncounterState, options: RepositorySaveOptions = {}): Promise<EncounterRecord> {
    await this.ready();
    assertEncounterState(state);
    const existing = this.encounters.get(state.id);
    if (!existing) throw new PersistenceValidationError(`Encounter ${state.id} does not exist.`);
    const expected = options.expectedRevision ?? existing.revision;
    if (expected !== existing.revision) throw new RevisionConflictError(state.id, expected, existing.revision);
    const record: EncounterRecord = { ...existing, state: clone(state), folderId: options.folderId === undefined ? existing.folderId : options.folderId, revision: existing.revision + 1, updatedAt: now() };
    this.encounters.set(state.id, record);
    return clone(record);
  }

  async duplicateEncounter(id: string, newId?: string): Promise<EncounterRecord> {
    const source = await this.getEncounter(id);
    if (!source) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    const targetId = newId ?? nextId(id, new Set(this.encounters.keys()));
    if (this.encounters.has(targetId)) throw new PersistenceValidationError(`Encounter ${targetId} already exists.`);
    return this.createEncounter({ ...source.state, id: targetId }, source.folderId);
  }

  async moveEncounter(id: string, folderId: string | null): Promise<EncounterRecord> {
    const source = await this.getEncounter(id);
    if (!source) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    if (
      folderId !== null &&
      this.library.state.sections.encounters.nodesById[folderId]?.type !== "folder"
    ) {
      throw new PersistenceValidationError(`Encounter folder ${folderId} does not exist.`);
    }
    const record = { ...source, folderId, updatedAt: now() };
    this.encounters.set(id, record);
    return clone(record);
  }

  async deleteEncounter(id: string): Promise<void> {
    await this.ready();
    this.encounters.delete(id);
    if (this.manifest?.activeEncounterId === id) {
      this.manifest = { ...this.manifest, activeEncounterId: null, revision: this.manifest.revision + 1, updatedAt: now() };
    }
  }

  async getRecoveryDraft(): Promise<RecoveryDraftRecord | null> { await this.ready(); return clone(this.recoveryDraft); }

  async saveRecoveryDraft(state: EncounterState): Promise<RecoveryDraftRecord> {
    assertEncounterState(state);
    this.recoveryDraft = { state: clone(state), updatedAt: now() };
    return clone(this.recoveryDraft);
  }

  async deleteRecoveryDraft(): Promise<void> { this.recoveryDraft = null; }

  async getLibrary(): Promise<LibraryRecord> { await this.ready(); return clone(this.library); }

  async saveLibrary(state: LibraryState): Promise<LibraryRecord> {
    const record: LibraryRecord = { state: clone(state), revision: this.library.revision + 1, updatedAt: now() };
    this.library = record;
    return clone(record);
  }

  private snapshot(): WorkspaceSnapshot {
    return { manifest: this.manifest as WorkspaceManifest, encounters: [...this.encounters.values()], recoveryDraft: this.recoveryDraft, library: this.library };
  }

  async exportWorkspace(): Promise<WorkspaceExportEnvelope> {
    await this.ready();
    return validateExportEnvelope({ kind: "workspace-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now(), workspace: clone(this.snapshot()) }) as WorkspaceExportEnvelope;
  }

  async exportEncounter(id: string): Promise<EncounterExportEnvelope> {
    const record = await this.getEncounter(id);
    if (!record) throw new PersistenceValidationError(`Encounter ${id} does not exist.`);
    return validateExportEnvelope({ kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now(), encounter: record.state, library: (await this.getLibrary()).state }) as EncounterExportEnvelope;
  }

  async importWorkspace(envelope: WorkspaceExportEnvelope, mode: "overwrite" | "merge"): Promise<WorkspaceManifest> {
    validateExportEnvelope(envelope);
    if (mode === "overwrite") {
      const snapshot = clone(envelope.workspace);
      this.manifest = snapshot.manifest;
      this.encounters.clear();
      snapshot.encounters.forEach((record) => this.encounters.set(record.id, record));
      this.recoveryDraft = snapshot.recoveryDraft;
      this.library = snapshot.library;
      return clone(this.manifest);
    }
    await this.ready();
    const used = new Set(this.encounters.keys());
    const remapped = new Map<string, string>();
    for (const source of envelope.workspace.encounters) {
      const id = nextId(source.id, used);
      used.add(id);
      remapped.set(source.id, id);
      this.encounters.set(id, { ...clone(source), id, state: { ...clone(source.state), id }, folderId: source.folderId });
    }
    const importedLibrary = clone(envelope.workspace.library.state);
    const libraryIdMap = new Map<string, string>();
    const mergedLibrary = clone(this.library.state);
    for (const sectionId of ["encounters", "backgrounds", "tokens"] as const) {
      const destination = mergedLibrary.sections[sectionId];
      const source = importedLibrary.sections[sectionId];
      const usedNodeIds = new Set(Object.keys(destination.nodesById));
      for (const sourceNode of Object.values(source.nodesById)) {
        if (sourceNode.id === source.rootId) {
          libraryIdMap.set(sourceNode.id, destination.rootId);
          continue;
        }
        // Every imported library node receives a fresh workspace-level ID,
        // even when its source ID happens not to collide locally.
        const id = nextId(`${sourceNode.id}-import`, usedNodeIds);
        usedNodeIds.add(id);
        libraryIdMap.set(sourceNode.id, id);
      }
      for (const sourceNode of Object.values(source.nodesById)) {
        if (sourceNode.id === source.rootId) continue;
        const id = libraryIdMap.get(sourceNode.id) as string;
        const parentId = libraryIdMap.get(sourceNode.parentId ?? source.rootId) ?? destination.rootId;
        const targetId = sourceNode.targetId
          ? sectionId === "encounters"
            ? remapped.get(sourceNode.targetId) ?? libraryIdMap.get(sourceNode.targetId)
            : libraryIdMap.get(sourceNode.targetId)
          : undefined;
        destination.nodesById[id] = {
          ...sourceNode,
          id,
          parentId,
          ...(sourceNode.type === "folder" ? { childIds: [] } : {}),
          ...(targetId ? { targetId } : {})
        };
        const parent = destination.nodesById[parentId];
        if (parent?.type === "folder") parent.childIds = [...(parent.childIds ?? []), id];
      }
      if (sectionId === "encounters") {
        for (const sourceRecord of envelope.workspace.encounters) {
          const importedId = remapped.get(sourceRecord.id);
          if (importedId) {
            const record = this.encounters.get(importedId);
            if (record?.folderId) {
              record.folderId =
                libraryIdMap.get(record.folderId) ?? destination.rootId;
            }
          }
        }
      }
    }
    this.library = { state: mergedLibrary, revision: this.library.revision + 1, updatedAt: now() };
    if (!this.recoveryDraft && envelope.workspace.recoveryDraft) this.recoveryDraft = clone(envelope.workspace.recoveryDraft);
    this.manifest = { ...this.manifest as WorkspaceManifest, revision: (this.manifest as WorkspaceManifest).revision + 1, updatedAt: now() };
    return clone(this.manifest);
  }

  async saveBackup(envelope: WorkspaceExportEnvelope): Promise<void> {
    validateExportEnvelope(envelope);
    this.latestBackup = clone(envelope);
  }

  async getLatestBackup(): Promise<WorkspaceExportEnvelope | null> {
    return clone(this.latestBackup);
  }

  async clearLocalData(): Promise<void> {
    this.manifest = null;
    this.encounters.clear();
    this.recoveryDraft = null;
    this.latestBackup = null;
    this.library = {
      state: createEmptyLibraryState(),
      revision: 0,
      updatedAt: now()
    };
  }
}

export const MemoryWorkspaceRepository = InMemoryWorkspaceRepository;
