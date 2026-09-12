import { CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";
import {
  assertEncounterState,
  assertLibraryState,
  migrateEncounterState
} from "../envelope";
import { WORKSPACE_SCHEMA_VERSION, type WorkspaceSnapshot } from "../types";
import type { CloudWorkspaceSnapshot } from "./cloudWorkspaceRepository";

type RecordValue = Record<string, unknown>;

function record(value: unknown, name: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} is invalid.`);
  return value as RecordValue;
}

function number(value: unknown, name: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const millis = (value as { toMillis?: () => number } | null)?.toMillis?.();
  if (typeof millis === "number") return millis;
  throw new Error(`${name} timestamp is invalid.`);
}

function revision(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${name} revision is invalid.`);
  return value as number;
}

function schema(value: RecordValue, name: string): void {
  if (value.schemaVersion !== CLOUD_RECORD_SCHEMA_VERSION) throw new Error(`${name} has an unsupported cloud schema version.`);
}

/** Validates Firebase data fully before constructing local repository records. */
export function parseCloudWorkspace(value: CloudWorkspaceSnapshot): WorkspaceSnapshot {
  const root = record(value.workspace, "cloud workspace");
  schema(root, "cloud workspace");
  const encounters = value.encounters.flatMap((item, index) => {
    const source = record(item, `cloud encounter ${index}`);
    schema(source, `cloud encounter ${index}`);
    if (source.deleted === true) return [];
    const state = migrateEncounterState(source.state);
    assertEncounterState(state, `cloud encounter ${index}.state`);
    if (source.encounterId !== state.id) throw new Error("Cloud encounter IDs do not agree.");
    return [{
      id: source.encounterId as string,
      state,
      folderId: source.folderId === null ? null : String(source.folderId),
      revision: revision(source.revision, `cloud encounter ${index}`),
      createdAt: number(source.createdAt, `cloud encounter ${index}.createdAt`),
      updatedAt: number(source.updatedAt, `cloud encounter ${index}.updatedAt`)
    }];
  });
  const librarySource = record(value.library, "cloud library");
  schema(librarySource, "cloud library");
  assertLibraryState(librarySource.state, "cloud library.state");
  const draftSource = value.recoveryDraft ? record(value.recoveryDraft, "cloud recovery draft") : null;
  if (draftSource && draftSource.deleted !== true) {
    schema(draftSource, "cloud recovery draft");
    draftSource.state = migrateEncounterState(draftSource.state);
    assertEncounterState(draftSource.state, "cloud recovery draft.state");
  }
  return {
    manifest: {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      activeEncounterId: null,
      revision: revision(root.revision, "cloud workspace"),
      updatedAt: number(root.updatedAt, "cloud workspace.updatedAt")
    },
    encounters,
    library: {
      state: librarySource.state,
      revision: revision(librarySource.revision, "cloud library"),
      updatedAt: number(librarySource.updatedAt, "cloud library.updatedAt")
    },
    recoveryDraft: draftSource && draftSource.deleted !== true ? {
      state: draftSource.state,
      updatedAt: number(draftSource.updatedAt, "cloud recovery draft.updatedAt")
    } : null
  } as WorkspaceSnapshot;
}
