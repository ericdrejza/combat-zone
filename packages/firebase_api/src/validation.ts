import {
  CLOUD_RECORD_SCHEMA_VERSION,
  FIREBASE_API_VERSION,
  SUPPORTED_ENCOUNTER_SCHEMA_VERSION,
  type CloudCommand,
  type CloudCommandResult,
  type DeleteEncounterPayload,
  type EncounterPayload,
  type EntitlementResult,
  type JsonObject,
  type JsonValue,
  type LibraryPayload,
  type RecoveryDraftPayload,
  type ReserveAssetUploadPayload,
  type ReserveAssetUploadResult,
  type CancelAssetUploadPayload,
  type StorageUsageResult,
  type ReplaceWorkspacePayload,
  type WorkspaceMetadataPayload
} from "./contracts.js";

export class ApiContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractValidationError";
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiContractValidationError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) {
    throw new ApiContractValidationError(`${name} must be a non-empty string.`);
  }
  return value;
}

function revision(value: unknown, name: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ApiContractValidationError(`${name} must be a non-negative integer or null.`);
  }
  return value as number;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new ApiContractValidationError(`${name} must be a positive integer.`);
  }
  return value as number;
}

function json(value: unknown, name: string, depth = 0): JsonValue {
  if (depth > 80) throw new ApiContractValidationError(`${name} is nested too deeply.`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => json(item, `${name}[${index}]`, depth + 1));
  const source = record(value, name);
  return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, json(item, `${name}.${key}`, depth + 1)]));
}

function schemaVersion(value: unknown, name: string): number {
  if (value !== CLOUD_RECORD_SCHEMA_VERSION) {
    throw new ApiContractValidationError(`${name} is unsupported.`);
  }
  return value as number;
}

function validateEntityCollection(value: unknown, name: string): void {
  const collection = record(value, name);
  const byId = record(collection.byId, `${name}.byId`);
  if (!Array.isArray(collection.allIds) || collection.allIds.some((id) => typeof id !== "string")) {
    throw new ApiContractValidationError(`${name}.allIds must contain strings.`);
  }
  const ids = collection.allIds as string[];
  if (new Set(ids).size !== ids.length || ids.some((id) => !(id in byId)) || Object.keys(byId).some((id) => !ids.includes(id))) {
    throw new ApiContractValidationError(`${name}.byId and allIds must agree.`);
  }
}

function validateEncounterStateShape(state: JsonObject): void {
  string(state.id, "encounter.state.id");
  if (state.schemaVersion !== SUPPORTED_ENCOUNTER_SCHEMA_VERSION) {
    throw new ApiContractValidationError("encounter.state.schemaVersion is unsupported.");
  }
  for (const key of ["zones", "edges", "actors", "engagements", "annotations"]) {
    validateEntityCollection(state[key], `encounter.state.${key}`);
  }
  record(state.initiativeTracker, "encounter.state.initiativeTracker");
  record(state.validationState, "encounter.state.validationState");
}

function assetIds(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new ApiContractValidationError(`${name} must be an array.`);
  const ids = value.map((item, index) => string(item, `${name}[${index}]`));
  if (ids.some((id) => !/^[a-f0-9]{64}$/.test(id))) throw new ApiContractValidationError(`${name} must contain SHA-256 asset IDs.`);
  if (new Set(ids).size !== ids.length) throw new ApiContractValidationError(`${name} contains duplicates.`);
  return ids;
}

function cloudImageAssetId(value: unknown, name: string): string | null {
  const source = record(value, name);
  if (source.kind === "url") {
    if (typeof source.url !== "string" || source.url.length > 2_048 || !/^https?:\/\//.test(source.url)) {
      throw new ApiContractValidationError(`${name}.url is invalid.`);
    }
    return null;
  }
  if (source.kind === "google_drive") {
    string(source.fileId, `${name}.fileId`);
    return null;
  }
  if (source.kind === "cloud_storage") {
    const assetId = string(source.assetId, `${name}.assetId`);
    if (!/^[a-f0-9]{64}$/.test(assetId)) throw new ApiContractValidationError(`${name}.assetId is invalid.`);
    string(source.generation, `${name}.generation`);
    return assetId;
  }
  throw new ApiContractValidationError(`${name} must be a URL, Google Drive, or ready cloud source.`);
}

function encounterAssetIds(state: JsonObject): string[] {
  const result: string[] = [];
  if (state.backgroundImage !== null && state.backgroundImage !== undefined) {
    const background = record(state.backgroundImage, "encounter.state.backgroundImage");
    const id = cloudImageAssetId(background.source, "encounter.state.backgroundImage.source");
    if (id) result.push(id);
  }
  const actors = record(record(state.actors, "encounter.state.actors").byId, "encounter.state.actors.byId");
  for (const [id, value] of Object.entries(actors)) {
    const actor = record(value, `encounter.state.actors.byId.${id}`);
    if (actor.image !== undefined) {
      const assetId = cloudImageAssetId(actor.image, `encounter.state.actors.byId.${id}.image`);
      if (assetId) result.push(assetId);
    }
  }
  return result;
}

function assertAssetIdsMatch(declared: string[], referenced: string[], name: string): void {
  const expected = [...new Set(referenced)].sort();
  if (JSON.stringify([...declared].sort()) !== JSON.stringify(expected)) {
    throw new ApiContractValidationError(`${name} must exactly match cloud-storage references.`);
  }
}

export function validateCommand<T>(value: unknown, validatePayload: (value: unknown) => T): CloudCommand<T> {
  const input = record(value, "command");
  if (input.apiVersion !== FIREBASE_API_VERSION) {
    throw new ApiContractValidationError("Unsupported API version.");
  }
  return {
    apiVersion: FIREBASE_API_VERSION,
    expectedRevision: revision(input.expectedRevision, "command.expectedRevision"),
    mutationId: string(input.mutationId, "command.mutationId"),
    payload: validatePayload(input.payload)
  };
}

export function validateWorkspaceMetadata(value: unknown): WorkspaceMetadataPayload {
  const input = record(value, "workspace");
  if (!Array.isArray(input.recentEncounters) || input.recentEncounters.length > 5) {
    throw new ApiContractValidationError("workspace.recentEncounters must contain at most five entries.");
  }
  const recentEncounters = input.recentEncounters.map((item, index) => {
    const recent = record(item, `workspace.recentEncounters[${index}]`);
    if (!Number.isFinite(recent.accessedAt)) throw new ApiContractValidationError("Recent access time is invalid.");
    return { encounterId: string(recent.encounterId, "recent.encounterId"), accessedAt: recent.accessedAt as number };
  });
  if (new Set(recentEncounters.map(({ encounterId }) => encounterId)).size !== recentEncounters.length) {
    throw new ApiContractValidationError("Recent encounter IDs must be unique.");
  }
  return {
    schemaVersion: schemaVersion(input.schemaVersion, "workspace.schemaVersion"),
    recentEncounters: recentEncounters.sort((left, right) => right.accessedAt - left.accessedAt)
  };
}

export function validateEncounter(value: unknown): EncounterPayload {
  const input = record(value, "encounter");
  const state = json(input.state, "encounter.state");
  if (Array.isArray(state) || state === null || typeof state !== "object") throw new ApiContractValidationError("encounter.state must be an object.");
  const encounterId = string(input.encounterId, "encounter.encounterId");
  if ((state as JsonObject).id !== encounterId) throw new ApiContractValidationError("Encounter IDs must agree.");
  validateEncounterStateShape(state as JsonObject);
  const declaredAssetIds = assetIds(input.assetIds, "encounter.assetIds");
  assertAssetIdsMatch(declaredAssetIds, encounterAssetIds(state as JsonObject), "encounter.assetIds");
  return { assetIds: declaredAssetIds, encounterId, folderId: input.folderId === null ? null : string(input.folderId, "encounter.folderId"), schemaVersion: schemaVersion(input.schemaVersion, "encounter.schemaVersion"), state: state as JsonObject };
}

export function validateDeleteEncounter(value: unknown): DeleteEncounterPayload {
  const input = record(value, "deleteEncounter");
  return { encounterId: string(input.encounterId, "deleteEncounter.encounterId"), schemaVersion: schemaVersion(input.schemaVersion, "deleteEncounter.schemaVersion") };
}

export function validateLibrary(value: unknown): LibraryPayload {
  const input = record(value, "library");
  const state = json(input.state, "library.state");
  if (Array.isArray(state) || state === null || typeof state !== "object") throw new ApiContractValidationError("library.state must be an object.");
  const sections = record((state as JsonObject).sections, "library.state.sections");
  const referenced: string[] = [];
  for (const sectionId of ["encounters", "backgrounds", "tokens"]) {
    const section = record(sections[sectionId], `library.state.sections.${sectionId}`);
    string(section.rootId, `library.state.sections.${sectionId}.rootId`);
    const nodes = record(section.nodesById, `library.state.sections.${sectionId}.nodesById`);
    for (const [nodeId, value] of Object.entries(nodes)) {
      const node = record(value, `library.state.sections.${sectionId}.nodesById.${nodeId}`);
      if (node.type === "image") {
        const asset = record(node.asset, `library image ${nodeId}.asset`);
        const assetId = cloudImageAssetId(asset.source, `library image ${nodeId}.asset.source`);
        if (assetId) referenced.push(assetId);
      }
    }
  }
  const declaredAssetIds = assetIds(input.assetIds, "library.assetIds");
  assertAssetIdsMatch(declaredAssetIds, referenced, "library.assetIds");
  return { assetIds: declaredAssetIds, schemaVersion: schemaVersion(input.schemaVersion, "library.schemaVersion"), state: state as JsonObject };
}

export function validateRecoveryDraft(value: unknown): RecoveryDraftPayload {
  if (value === null) return null;
  const input = record(value, "recoveryDraft");
  const state = json(input.state, "recoveryDraft.state");
  if (Array.isArray(state) || state === null || typeof state !== "object") throw new ApiContractValidationError("recoveryDraft.state must be an object.");
  validateEncounterStateShape(state as JsonObject);
  const declaredAssetIds = assetIds(input.assetIds, "recoveryDraft.assetIds");
  assertAssetIdsMatch(declaredAssetIds, encounterAssetIds(state as JsonObject), "recoveryDraft.assetIds");
  return { assetIds: declaredAssetIds, schemaVersion: schemaVersion(input.schemaVersion, "recoveryDraft.schemaVersion"), state: state as JsonObject };
}

export function validateReplaceWorkspace(value: unknown): ReplaceWorkspacePayload {
  const input = record(value, "replaceWorkspace");
  if (!Array.isArray(input.encounters)) throw new ApiContractValidationError("replaceWorkspace.encounters must be an array.");
  const encounters = input.encounters.map(validateEncounter);
  if (new Set(encounters.map(({ encounterId }) => encounterId)).size !== encounters.length) throw new ApiContractValidationError("Encounter IDs must be unique.");
  return { workspace: validateWorkspaceMetadata(input.workspace), encounters, library: validateLibrary(input.library), recoveryDraft: validateRecoveryDraft(input.recoveryDraft) };
}

export function validateCommandResult(value: unknown): CloudCommandResult {
  const result = record(value, "result");
  if (result.status !== "applied" && result.status !== "already_applied") throw new ApiContractValidationError("result.status is invalid.");
  if (!Number.isSafeInteger(result.revision) || (result.revision as number) < 1 || !Number.isFinite(result.updatedAt)) throw new ApiContractValidationError("result revision or timestamp is invalid.");
  return { status: result.status, mutationId: string(result.mutationId, "result.mutationId"), revision: result.revision as number, updatedAt: result.updatedAt as number };
}

export function validateEntitlementResult(value: unknown): EntitlementResult {
  const result = record(value, "entitlement");
  const features = record(result.features, "entitlement.features");
  const limits = record(result.limits, "entitlement.limits");
  if (result.apiVersion !== FIREBASE_API_VERSION || typeof features.cloudSync !== "boolean") throw new ApiContractValidationError("entitlement is invalid.");
  return {
    apiVersion: FIREBASE_API_VERSION,
    features: { cloudSync: features.cloudSync },
    limits: {
      backgroundMaxBytes: positiveInteger(limits.backgroundMaxBytes, "entitlement.limits.backgroundMaxBytes"),
      tokenMaxBytes: positiveInteger(limits.tokenMaxBytes, "entitlement.limits.tokenMaxBytes"),
      totalStorageBytes: positiveInteger(limits.totalStorageBytes, "entitlement.limits.totalStorageBytes")
    },
    tierId: string(result.tierId, "entitlement.tierId")
  };
}

export function validateReserveAssetUpload(value: unknown): ReserveAssetUploadPayload {
  const input = record(value, "reserveAssetUpload");
  const assetId = string(input.assetId, "reserveAssetUpload.assetId");
  if (!/^[a-f0-9]{64}$/.test(assetId)) throw new ApiContractValidationError("reserveAssetUpload.assetId must be a SHA-256 digest.");
  if (input.assetType !== "background" && input.assetType !== "token") throw new ApiContractValidationError("reserveAssetUpload.assetType is invalid.");
  const mediaType = string(input.mediaType, "reserveAssetUpload.mediaType");
  if (!mediaType.startsWith("image/")) throw new ApiContractValidationError("Only image uploads are supported.");
  return { assetId, assetType: input.assetType, expectedBytes: positiveInteger(input.expectedBytes, "reserveAssetUpload.expectedBytes"), mediaType };
}

export function validateCancelAssetUpload(value: unknown): CancelAssetUploadPayload {
  const input = record(value, "cancelAssetUpload");
  return { reservationId: string(input.reservationId, "cancelAssetUpload.reservationId") };
}

export function validateReserveAssetUploadResult(value: unknown): ReserveAssetUploadResult {
  const result = record(value, "reserveAssetUploadResult");
  const assetId = string(result.assetId, "reserveAssetUploadResult.assetId");
  if (result.status === "ready") return { status: "ready", assetId, generation: string(result.generation, "reserveAssetUploadResult.generation") };
  if (result.status === "pending") return { status: "pending", assetId };
  if (result.status === "reserved") return { status: "reserved", assetId, reservationId: string(result.reservationId, "reserveAssetUploadResult.reservationId"), expiresAt: positiveInteger(result.expiresAt, "reserveAssetUploadResult.expiresAt") };
  throw new ApiContractValidationError("reserveAssetUploadResult.status is invalid.");
}

export function validateStorageUsageResult(value: unknown): StorageUsageResult {
  const result = record(value, "storageUsage");
  const read = (key: string) => {
    const item = result[key];
    if (!Number.isSafeInteger(item) || (item as number) < 0) throw new ApiContractValidationError(`storageUsage.${key} is invalid.`);
    return item as number;
  };
  return { limitBytes: read("limitBytes"), reservedBytes: read("reservedBytes"), storedBytes: read("storedBytes"), updatedAt: read("updatedAt") };
}
