import {
  assertEncounterState,
  assertLibraryState,
  migrateEncounterState,
  migrateLibraryState
} from "./envelope";
import {
  PersistenceValidationError,
  WORKSPACE_SCHEMA_VERSION,
  type EncounterRecord,
  type LibraryRecord,
  type RecoveryDraftRecord,
  type WorkspaceManifest
} from "./types";

/** Migrates and validates records read directly from IndexedDB before Redux sees them. */
export function hydrateEncounterRecord(record: EncounterRecord): EncounterRecord {
  const state = migrateEncounterState(record.state);
  assertEncounterState(state);
  return { ...record, state };
}

export function hydrateRecoveryDraft(record: RecoveryDraftRecord): RecoveryDraftRecord {
  const state = migrateEncounterState(record.state);
  assertEncounterState(state, "recoveryDraft.state");
  return { ...record, state };
}

export function hydrateLibraryRecord(record: LibraryRecord): LibraryRecord {
  const state = migrateLibraryState(record.state);
  assertLibraryState(state);
  return { ...record, state };
}

export function hydrateManifest(manifest: WorkspaceManifest): WorkspaceManifest {
  const schemaVersion = (manifest as { schemaVersion: number }).schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new PersistenceValidationError("Workspace manifest has an unsupported schema version.");
  }
  return { ...manifest, schemaVersion: WORKSPACE_SCHEMA_VERSION };
}
