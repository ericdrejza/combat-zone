import type { EncounterState } from "@core/encounter/types";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import type { LibraryState } from "@library/types";
import type {
  LocalAssetRecord,
  WorkspaceSnapshot
} from "./types";

export type Internalized<T> = {
  assets: LocalAssetRecord[];
  changed: boolean;
  value: T;
};

function blobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true });
    reader.addEventListener(
      "error",
      () => reject(reader.error ?? new Error("Local asset could not be read.")),
      { once: true }
    );
    reader.readAsArrayBuffer(blob);
  });
}

export async function localAssetId(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blobArrayBuffer(blob));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Embedded asset data URL is invalid.");
  const metadata = dataUrl.slice(5, separator);
  const mediaType = metadata.split(";", 1)[0] || "application/octet-stream";
  const payload = dataUrl.slice(separator + 1);
  if (metadata.includes(";base64")) {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mediaType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mediaType });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener(
      "error",
      () => reject(reader.error ?? new Error("Local asset could not be exported.")),
      { once: true }
    );
    reader.readAsDataURL(blob);
  });
}

export async function createLocalAssetRecord(blob: Blob): Promise<LocalAssetRecord> {
  return { assetId: await localAssetId(blob), blob, createdAt: Date.now() };
}

function visitEncounterSources(
  encounter: EncounterState,
  visit: (source: ImageAssetSource) => void
) {
  if (encounter.backgroundImage) visit(encounter.backgroundImage.source);
  for (const actor of Object.values(encounter.actors.byId)) {
    if (actor.image) visit(actor.image);
  }
}

function visitLibrarySources(
  library: LibraryState,
  visit: (source: ImageAssetSource) => void
) {
  for (const sectionId of ["backgrounds", "tokens"] as const) {
    for (const node of Object.values(library.sections[sectionId].nodesById)) {
      if (node.type === "image" && node.asset) visit(node.asset.source);
    }
  }
}

export function collectLocalAssetIds(snapshot: WorkspaceSnapshot): Set<string> {
  const ids = new Set<string>();
  const collect = (source: ImageAssetSource) => {
    if (source.kind === "local_asset") ids.add(source.assetId);
  };
  visitLibrarySources(snapshot.library.state, collect);
  for (const record of snapshot.encounters) visitEncounterSources(record.state, collect);
  if (snapshot.recoveryDraft) visitEncounterSources(snapshot.recoveryDraft.state, collect);
  return ids;
}

export function hasEmbeddedAssets(snapshot: WorkspaceSnapshot): boolean {
  let found = false;
  const inspect = (source: ImageAssetSource) => {
    if (source.kind === "embedded") found = true;
  };
  visitLibrarySources(snapshot.library.state, inspect);
  for (const record of snapshot.encounters) visitEncounterSources(record.state, inspect);
  if (snapshot.recoveryDraft) visitEncounterSources(snapshot.recoveryDraft.state, inspect);
  return found;
}

async function internalizeSources(
  encounter: EncounterState | null,
  library: LibraryState | null,
  records: Map<string, LocalAssetRecord>,
  memo = new Map<string, Promise<ImageAssetSource>>()
) {
  const internalize = (source: ImageAssetSource): Promise<ImageAssetSource> => {
    if (source.kind !== "embedded") return Promise.resolve(source);
    const cached = memo.get(source.dataUrl);
    if (cached) return cached;
    const pending = createLocalAssetRecord(dataUrlToBlob(source.dataUrl)).then((record) => {
      records.set(record.assetId, record);
      return {
        kind: "local_asset" as const,
        assetId: record.assetId,
        byteLength: record.blob.size
      };
    });
    memo.set(source.dataUrl, pending);
    return pending;
  };
  if (encounter?.backgroundImage) {
    encounter.backgroundImage.source = await internalize(encounter.backgroundImage.source);
  }
  if (encounter) {
    for (const actor of Object.values(encounter.actors.byId)) {
      if (actor.image) actor.image = await internalize(actor.image);
    }
  }
  if (library) {
    for (const sectionId of ["backgrounds", "tokens"] as const) {
      for (const node of Object.values(library.sections[sectionId].nodesById)) {
        if (node.type === "image" && node.asset) {
          node.asset.source = await internalize(node.asset.source);
        }
      }
    }
  }
}

export async function internalizeWorkspace(
  snapshot: WorkspaceSnapshot
): Promise<Internalized<WorkspaceSnapshot>> {
  if (!hasEmbeddedAssets(snapshot)) return { assets: [], changed: false, value: snapshot };
  const value = structuredClone(snapshot);
  const records = new Map<string, LocalAssetRecord>();
  const memo = new Map<string, Promise<ImageAssetSource>>();
  await internalizeSources(null, value.library.state, records, memo);
  for (const record of value.encounters) {
    await internalizeSources(record.state, null, records, memo);
  }
  if (value.recoveryDraft) {
    await internalizeSources(value.recoveryDraft.state, null, records, memo);
  }
  return { assets: [...records.values()], changed: true, value };
}

export async function internalizeEncounter(
  encounter: EncounterState
): Promise<Internalized<EncounterState>> {
  let changed = false;
  visitEncounterSources(encounter, (source) => {
    if (source.kind === "embedded") changed = true;
  });
  if (!changed) return { assets: [], changed: false, value: encounter };
  const value = structuredClone(encounter);
  const records = new Map<string, LocalAssetRecord>();
  await internalizeSources(value, null, records);
  return { assets: [...records.values()], changed: true, value };
}

export async function internalizeLibrary(
  library: LibraryState
): Promise<Internalized<LibraryState>> {
  let changed = false;
  visitLibrarySources(library, (source) => {
    if (source.kind === "embedded") changed = true;
  });
  if (!changed) return { assets: [], changed: false, value: library };
  const value = structuredClone(library);
  const records = new Map<string, LocalAssetRecord>();
  await internalizeSources(null, value, records);
  return { assets: [...records.values()], changed: true, value };
}

async function embedSource(
  source: ImageAssetSource,
  resolve: (assetId: string) => Promise<Blob | null>
): Promise<ImageAssetSource> {
  if (source.kind !== "local_asset") return source;
  const blob = await resolve(source.assetId);
  if (!blob) throw new Error(`Local asset ${source.assetId} is missing.`);
  return { kind: "embedded", dataUrl: await blobToDataUrl(blob) };
}

export async function embedLocalAssets(
  snapshot: WorkspaceSnapshot,
  resolve: (assetId: string) => Promise<Blob | null>
): Promise<WorkspaceSnapshot> {
  const value = structuredClone(snapshot);
  const memo = new Map<string, Promise<ImageAssetSource>>();
  const embed = (source: ImageAssetSource) => {
    if (source.kind !== "local_asset") return Promise.resolve(source);
    const cached = memo.get(source.assetId);
    if (cached) return cached;
    const pending = embedSource(source, resolve);
    memo.set(source.assetId, pending);
    return pending;
  };
  const embedEncounter = async (encounter: EncounterState) => {
    if (encounter.backgroundImage) {
      encounter.backgroundImage.source = await embed(encounter.backgroundImage.source);
    }
    for (const actor of Object.values(encounter.actors.byId)) {
      if (actor.image) actor.image = await embed(actor.image);
    }
  };
  for (const sectionId of ["backgrounds", "tokens"] as const) {
    for (const node of Object.values(value.library.state.sections[sectionId].nodesById)) {
      if (node.type === "image" && node.asset) node.asset.source = await embed(node.asset.source);
    }
  }
  for (const record of value.encounters) await embedEncounter(record.state);
  if (value.recoveryDraft) await embedEncounter(value.recoveryDraft.state);
  return value;
}
