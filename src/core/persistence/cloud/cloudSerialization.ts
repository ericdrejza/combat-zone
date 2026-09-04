import type { EncounterPayload, LibraryPayload, RecoveryDraftPayload } from "@combat-zone/firebase-api";
import { CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterRecord, LibraryRecord, RecoveryDraftRecord } from "../types";
import type { LibraryState } from "@library/types";
import type { CloudAssetRepository } from "./cloudAssetRepository";
import type { CloudAssetType } from "@combat-zone/firebase-api";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";

const clone = <T>(value: T): T => structuredClone(value);

function assetId(source: { kind: string; assetId?: string }): string | null {
  return source.kind === "cloud_storage" && source.assetId ? source.assetId : null;
}

function cloudSource(
  source: ImageAssetSource,
  type: CloudAssetType,
  mediaType: string,
  assets: CloudAssetRepository
): Promise<ImageAssetSource> {
  return source.kind === "embedded"
    ? assets.ensureUploaded(source, type, mediaType)
    : Promise.resolve(source);
}

export async function serializeEncounterForCloud(
  record: EncounterRecord | RecoveryDraftRecord,
  assets: CloudAssetRepository
): Promise<{ state: EncounterState; assetIds: string[] }> {
  const state = clone(record.state);
  const ids = new Set<string>();
  if (state.backgroundImage) {
    state.backgroundImage.source = await cloudSource(
      state.backgroundImage.source,
      "background",
      state.backgroundImage.mediaType,
      assets
    );
    const id = assetId(state.backgroundImage.source);
    if (id) ids.add(id);
  }
  for (const actor of Object.values(state.actors.byId)) {
    if (!actor.image) continue;
    const mediaType = typeof actor.metadata.sourceAssetMediaType === "string"
      ? actor.metadata.sourceAssetMediaType
      : "image/*";
    actor.image = await cloudSource(actor.image, "token", mediaType, assets);
    const id = assetId(actor.image);
    if (id) ids.add(id);
  }
  return { state, assetIds: [...ids].sort() };
}

export async function encounterPayload(
  record: EncounterRecord,
  assets: CloudAssetRepository
): Promise<EncounterPayload> {
  const serialized = await serializeEncounterForCloud(record, assets);
  return {
    schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
    encounterId: record.id,
    folderId: record.folderId,
    assetIds: serialized.assetIds,
    state: serialized.state as unknown as EncounterPayload["state"]
  };
}

export async function draftPayload(
  record: RecoveryDraftRecord | null,
  assets: CloudAssetRepository
): Promise<RecoveryDraftPayload> {
  if (!record) return null;
  const serialized = await serializeEncounterForCloud(record, assets);
  return {
    schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
    assetIds: serialized.assetIds,
    state: serialized.state as unknown as Exclude<RecoveryDraftPayload, null>["state"]
  };
}

export async function libraryPayload(
  record: LibraryRecord,
  assets: CloudAssetRepository
): Promise<LibraryPayload> {
  const state: LibraryState = clone(record.state);
  const ids = new Set<string>();
  for (const sectionId of ["backgrounds", "tokens"] as const) {
    for (const node of Object.values(state.sections[sectionId].nodesById)) {
      if (node.type !== "image" || !node.asset) continue;
      node.asset.source = await cloudSource(node.asset.source, sectionId === "backgrounds" ? "background" : "token", node.asset.mediaType, assets);
      const id = assetId(node.asset.source);
      if (id) ids.add(id);
    }
  }
  return {
    schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
    assetIds: [...ids].sort(),
    state: state as unknown as LibraryPayload["state"]
  };
}
