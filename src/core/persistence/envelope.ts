import { ENCOUNTER_SCHEMA_VERSION, type EncounterState } from "@core/encounter/types";
import type { LibraryState } from "@library/types";
import { isImageAssetSource, migrateLegacyImageSource } from "@core/assets/imageAssetSource";
import {
  EXPORT_SCHEMA_VERSION,
  PersistenceValidationError,
  WORKSPACE_SCHEMA_VERSION,
  type EncounterExportEnvelope,
  type ExportEnvelope,
  type WorkspaceExportEnvelope,
  type WorkspaceSnapshot
} from "./types";

type UnknownRecord = Record<string, unknown>;

const LEGACY_ENCOUNTER_SCHEMA_VERSION = 5;
const LEGACY_EXPORT_SCHEMA_VERSION = 1;
const LEGACY_WORKSPACE_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PersistenceValidationError(`${name} must be a non-empty string.`);
  }
  return value;
}

function requiredFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PersistenceValidationError(`${name} must be a finite number.`);
  }
  return value;
}

function validateEntityCollection(value: unknown, name: string): void {
  if (!isRecord(value) || !isRecord(value.byId) || !Array.isArray(value.allIds)) {
    throw new PersistenceValidationError(`${name} must be a normalized entity collection.`);
  }
  if (!value.allIds.every((id) => typeof id === "string")) {
    throw new PersistenceValidationError(`${name}.allIds must contain strings.`);
  }
  const ids = value.allIds as string[];
  const byId = value.byId as UnknownRecord;
  if (new Set(ids).size !== ids.length) {
    throw new PersistenceValidationError(`${name}.allIds must not contain duplicates.`);
  }
  if (
    ids.some((id) => !(id in byId)) ||
    Object.keys(byId).some((id) => !ids.includes(id))
  ) {
    throw new PersistenceValidationError(`${name}.byId and allIds must agree.`);
  }
}

/** Performs the inexpensive structural checks needed before data reaches Redux. */
export function assertEncounterState(value: unknown, name = "encounter"): asserts value is EncounterState {
  if (!isRecord(value)) {
    throw new PersistenceValidationError(`${name} must be an object.`);
  }
  if (value.schemaVersion !== ENCOUNTER_SCHEMA_VERSION) {
    throw new PersistenceValidationError(
      `${name}.schemaVersion ${String(value.schemaVersion)} is unsupported.`
    );
  }
  requiredString(value.id, `${name}.id`);
  if (typeof value.name !== "string") {
    throw new PersistenceValidationError(`${name}.name must be a string.`);
  }
  for (const collection of ["zones", "edges", "actors", "engagements", "annotations"] as const) {
    validateEntityCollection(value[collection], `${name}.${collection}`);
  }
  if (!isRecord(value.initiativeTracker) || !Array.isArray(value.initiativeTracker.entries)) {
    throw new PersistenceValidationError(`${name}.initiativeTracker is invalid.`);
  }
  if (!isRecord(value.validationState) || typeof value.validationState.mode !== "string" || !Array.isArray(value.validationState.messages)) {
    throw new PersistenceValidationError(`${name}.validationState is invalid.`);
  }
  if (!isRecord(value.canvasSize) || typeof value.canvasSize.width !== "number" || typeof value.canvasSize.height !== "number") {
    throw new PersistenceValidationError(`${name}.canvasSize is invalid.`);
  }
  if (value.backgroundImage !== null && !isRecord(value.backgroundImage)) {
    throw new PersistenceValidationError(`${name}.backgroundImage is invalid.`);
  }
  if (
    isRecord(value.backgroundImage) &&
    !isImageAssetSource(value.backgroundImage.source)
  ) {
    throw new PersistenceValidationError(`${name}.backgroundImage.source is invalid.`);
  }
  for (const actorId of (value.actors as { allIds: string[] }).allIds) {
    const actor = (value.actors as { byId: UnknownRecord }).byId[actorId];
    if (isRecord(actor) && actor.image !== undefined && !isImageAssetSource(actor.image)) {
      throw new PersistenceValidationError(`${name}.actors.${actorId}.image is invalid.`);
    }
  }
}

export function assertLibraryState(value: unknown, name = "library"): asserts value is LibraryState {
  if (!isRecord(value) || !isRecord(value.sections)) {
    throw new PersistenceValidationError(`${name} must contain sections.`);
  }
  for (const sectionId of ["encounters", "backgrounds", "tokens"] as const) {
    const section = value.sections[sectionId];
    if (!isRecord(section) || typeof section.rootId !== "string" || !isRecord(section.nodesById)) {
      throw new PersistenceValidationError(`${name}.sections.${sectionId} is invalid.`);
    }
    const nodesById = section.nodesById as UnknownRecord;
    const root = nodesById[section.rootId];
    if (!isRecord(root) || root.type !== "folder") {
      throw new PersistenceValidationError(`${name}.sections.${sectionId} has no root folder.`);
    }
    for (const [nodeId, node] of Object.entries(nodesById)) {
      if (!isRecord(node) || node.id !== nodeId || node.sectionId !== sectionId) {
        throw new PersistenceValidationError(
          `${name}.sections.${sectionId}.nodesById.${nodeId} is invalid.`
        );
      }
      if (nodeId !== section.rootId) {
        if (typeof node.parentId !== "string" || !isRecord(nodesById[node.parentId])) {
          throw new PersistenceValidationError(`${name} node ${nodeId} has an invalid parent.`);
        }
      }
      if (
        node.type === "folder" &&
        (!Array.isArray(node.childIds) ||
          node.childIds.some(
            (childId) =>
              typeof childId !== "string" || !isRecord(nodesById[childId])
          ))
      ) {
        throw new PersistenceValidationError(`${name} folder ${nodeId} has invalid children.`);
      }
      if (
        node.type === "image" &&
        (!isRecord(node.asset) || !isImageAssetSource(node.asset.source))
      ) {
        throw new PersistenceValidationError(`${name} image ${nodeId} has an invalid source.`);
      }
    }
  }
}

function assertWorkspaceSnapshot(value: unknown): asserts value is WorkspaceSnapshot {
  if (!isRecord(value) || !isRecord(value.manifest) || !Array.isArray(value.encounters)) {
    throw new PersistenceValidationError("workspace is invalid.");
  }
  const manifest = value.manifest;
  if (manifest.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new PersistenceValidationError("workspace.manifest has an unsupported schema version.");
  }
  if (manifest.activeEncounterId !== null && typeof manifest.activeEncounterId !== "string") {
    throw new PersistenceValidationError("workspace.manifest.activeEncounterId is invalid.");
  }
  requiredFiniteNumber(manifest.revision, "workspace.manifest.revision");
  requiredFiniteNumber(manifest.updatedAt, "workspace.manifest.updatedAt");
  const encounterIds = new Set<string>();
  for (const [index, record] of value.encounters.entries()) {
    if (!isRecord(record)) {
      throw new PersistenceValidationError(`workspace.encounters[${index}] is invalid.`);
    }
    requiredString(record.id, `workspace.encounters[${index}].id`);
    assertEncounterState(record.state, `workspace.encounters[${index}].state`);
    if (record.id !== record.state.id || encounterIds.has(record.id)) {
      throw new PersistenceValidationError(
        `workspace.encounters[${index}] has an invalid or duplicate ID.`
      );
    }
    encounterIds.add(record.id);
    requiredFiniteNumber(record.revision, `workspace.encounters[${index}].revision`);
    requiredFiniteNumber(record.createdAt, `workspace.encounters[${index}].createdAt`);
    requiredFiniteNumber(record.updatedAt, `workspace.encounters[${index}].updatedAt`);
    if (record.folderId !== null && typeof record.folderId !== "string") {
      throw new PersistenceValidationError(`workspace.encounters[${index}].folderId is invalid.`);
    }
  }
  if (value.recoveryDraft !== null) {
    if (!isRecord(value.recoveryDraft)) {
      throw new PersistenceValidationError("workspace.recoveryDraft is invalid.");
    }
    assertEncounterState(value.recoveryDraft.state, "workspace.recoveryDraft.state");
    requiredFiniteNumber(value.recoveryDraft.updatedAt, "workspace.recoveryDraft.updatedAt");
  }
  if (!isRecord(value.library)) {
    throw new PersistenceValidationError("workspace.library is invalid.");
  }
  assertLibraryState(value.library.state);
  requiredFiniteNumber(value.library.revision, "workspace.library.revision");
  requiredFiniteNumber(value.library.updatedAt, "workspace.library.updatedAt");
  if (
    manifest.activeEncounterId !== null &&
    !encounterIds.has(manifest.activeEncounterId)
  ) {
    throw new PersistenceValidationError(
      "workspace.manifest.activeEncounterId does not reference an encounter."
    );
  }
  const encounterFolders = value.library.state.sections.encounters.nodesById;
  for (const record of value.encounters) {
    if (
      record.folderId !== null &&
      encounterFolders[record.folderId]?.type !== "folder"
    ) {
      throw new PersistenceValidationError(
        `Encounter ${record.id} references an invalid Library folder.`
      );
    }
  }
}

function assertEnvelopeHeader(value: unknown): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    throw new PersistenceValidationError("Export envelope must be an object.");
  }
  if (value.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new PersistenceValidationError(
      `Export schema version ${String(value.schemaVersion)} is unsupported.`
    );
  }
  requiredFiniteNumber(value.exportedAt, "exportedAt");
}

export function validateExportEnvelope(value: unknown): ExportEnvelope {
  assertEnvelopeHeader(value);
  if (value.kind === "workspace-export") {
    assertWorkspaceSnapshot(value.workspace);
    return value as unknown as WorkspaceExportEnvelope;
  }
  if (value.kind === "encounter-export") {
    assertEncounterState(value.encounter);
    assertLibraryState(value.library);
    return value as unknown as EncounterExportEnvelope;
  }
  throw new PersistenceValidationError(`Unsupported export kind ${String(value.kind)}.`);
}

function migrateImageRecord(value: UnknownRecord): UnknownRecord {
  if (isImageAssetSource(value.source)) return value;
  if (typeof value.dataUrl !== "string") return value;
  const { dataUrl, ...record } = value;
  return { ...record, source: migrateLegacyImageSource(dataUrl) };
}

export function migrateLibraryState(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.sections)) return value;
  const migrated = structuredClone(value);
  const sections = migrated.sections as UnknownRecord;
  for (const section of Object.values(sections)) {
    if (!isRecord(section) || !isRecord(section.nodesById)) continue;
    for (const node of Object.values(section.nodesById)) {
      if (isRecord(node) && node.type === "image" && isRecord(node.asset)) {
        node.asset = migrateImageRecord(node.asset);
      }
    }
  }
  return migrated;
}

export function migrateEncounterState(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== LEGACY_ENCOUNTER_SCHEMA_VERSION) return value;
  const migrated = structuredClone(value);
  migrated.schemaVersion = ENCOUNTER_SCHEMA_VERSION;
  if (isRecord(migrated.backgroundImage)) {
    migrated.backgroundImage = migrateImageRecord(migrated.backgroundImage);
  }
  if (isRecord(migrated.actors) && isRecord(migrated.actors.byId)) {
    for (const actor of Object.values(migrated.actors.byId)) {
      if (isRecord(actor) && typeof actor.image === "string") {
        actor.image = migrateLegacyImageSource(actor.image);
      }
    }
  }
  return migrated;
}

function migrateWorkspace(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.manifest)) return value;
  const migrated = structuredClone(value);
  const manifest = migrated.manifest as UnknownRecord;
  if (manifest.schemaVersion === LEGACY_WORKSPACE_SCHEMA_VERSION) {
    manifest.schemaVersion = WORKSPACE_SCHEMA_VERSION;
  }
  if (Array.isArray(migrated.encounters)) {
    for (const record of migrated.encounters) {
      if (isRecord(record)) record.state = migrateEncounterState(record.state);
    }
  }
  if (isRecord(migrated.recoveryDraft)) {
    migrated.recoveryDraft.state = migrateEncounterState(migrated.recoveryDraft.state);
  }
  if (isRecord(migrated.library)) {
    migrated.library.state = migrateLibraryState(migrated.library.state);
  }
  return migrated;
}

/**
 * Migration is deliberately explicit: silently accepting a newer document can
 * discard fields. Older migrations can be added here without changing callers.
 */
export function migrateExportEnvelope(value: unknown): ExportEnvelope {
  if (!isRecord(value)) return validateExportEnvelope(value);
  const migrated = structuredClone(value);
  if (migrated.schemaVersion === LEGACY_EXPORT_SCHEMA_VERSION) {
    migrated.schemaVersion = EXPORT_SCHEMA_VERSION;
    if (migrated.kind === "workspace-export") {
      migrated.workspace = migrateWorkspace(migrated.workspace);
    } else if (migrated.kind === "encounter-export") {
      migrated.encounter = migrateEncounterState(migrated.encounter);
      migrated.library = migrateLibraryState(migrated.library);
    }
  }
  return validateExportEnvelope(migrated);
}

/** Parses current envelopes and explicitly upgrades every supported legacy form. */
export const parseExportEnvelope = migrateExportEnvelope;
