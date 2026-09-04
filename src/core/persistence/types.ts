import type { EncounterState } from "@core/encounter/types";
import type { LibraryState } from "@library/types";

/** Current versions describe the persisted wrapper, not the encounter model. */
export const WORKSPACE_SCHEMA_VERSION = 2 as const;
export const EXPORT_SCHEMA_VERSION = 2 as const;

export type WorkspaceSchemaVersion = typeof WORKSPACE_SCHEMA_VERSION;
export type ExportSchemaVersion = typeof EXPORT_SCHEMA_VERSION;

export type WorkspaceManifest = {
  schemaVersion: WorkspaceSchemaVersion;
  activeEncounterId: string | null;
  revision: number;
  updatedAt: number;
};

export type EncounterRecord = {
  id: string;
  state: EncounterState;
  folderId: string | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
};

export type RecoveryDraftRecord = {
  state: EncounterState;
  updatedAt: number;
};

export type LibraryRecord = {
  state: LibraryState;
  revision: number;
  updatedAt: number;
};

export type WorkspaceSnapshot = {
  manifest: WorkspaceManifest;
  encounters: EncounterRecord[];
  recoveryDraft: RecoveryDraftRecord | null;
  library: LibraryRecord;
};

export type WorkspaceExportEnvelope = {
  kind: "workspace-export";
  schemaVersion: ExportSchemaVersion;
  exportedAt: number;
  workspace: WorkspaceSnapshot;
};

export type EncounterExportEnvelope = {
  kind: "encounter-export";
  schemaVersion: ExportSchemaVersion;
  exportedAt: number;
  encounter: EncounterState;
  /** The full library is embedded to retain image data referenced by the encounter. */
  library: LibraryState;
};

export type ExportEnvelope = WorkspaceExportEnvelope | EncounterExportEnvelope;

export type RepositorySaveOptions = {
  expectedRevision?: number;
  folderId?: string | null;
};

export type WorkspaceRepository = {
  initialize(): Promise<WorkspaceManifest>;
  getManifest(): Promise<WorkspaceManifest>;
  saveManifest(manifest: WorkspaceManifest): Promise<WorkspaceManifest>;
  createEncounter(
    state: EncounterState,
    folderId?: string | null
  ): Promise<EncounterRecord>;
  listEncounters(): Promise<EncounterRecord[]>;
  getEncounter(id: string): Promise<EncounterRecord | null>;
  saveEncounter(
    state: EncounterState,
    options?: RepositorySaveOptions
  ): Promise<EncounterRecord>;
  duplicateEncounter(id: string, newId?: string): Promise<EncounterRecord>;
  moveEncounter(id: string, folderId: string | null): Promise<EncounterRecord>;
  deleteEncounter(id: string): Promise<void>;
  getRecoveryDraft(): Promise<RecoveryDraftRecord | null>;
  saveRecoveryDraft(state: EncounterState): Promise<RecoveryDraftRecord>;
  deleteRecoveryDraft(): Promise<void>;
  getLibrary(): Promise<LibraryRecord>;
  saveLibrary(state: LibraryState): Promise<LibraryRecord>;
  exportWorkspace(): Promise<WorkspaceExportEnvelope>;
  exportEncounter(id: string): Promise<EncounterExportEnvelope>;
  importWorkspace(
    envelope: WorkspaceExportEnvelope,
    mode: "overwrite" | "merge"
  ): Promise<WorkspaceManifest>;
  saveBackup(envelope: WorkspaceExportEnvelope): Promise<void>;
  getLatestBackup(): Promise<WorkspaceExportEnvelope | null>;
  clearLocalData(): Promise<void>;
};

export class RevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT" as const;

  constructor(
    public readonly encounterId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision: number
  ) {
    super(
      `Encounter ${encounterId} changed (expected revision ${expectedRevision}, ` +
        `found ${actualRevision}).`
    );
    this.name = "RevisionConflictError";
  }
}

export class PersistenceValidationError extends Error {
  readonly code = "PERSISTENCE_VALIDATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "PersistenceValidationError";
  }
}
