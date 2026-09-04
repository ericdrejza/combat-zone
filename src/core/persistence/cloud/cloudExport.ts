import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import type { EncounterState } from "@core/encounter/types";
import type { LibraryState } from "@library/types";
import type { EncounterExportEnvelope, WorkspaceExportEnvelope } from "../types";

type ResolveAsset = (source: ImageAssetSource) => Promise<Blob | string>;

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Image export failed."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function embedded(source: ImageAssetSource, resolve: ResolveAsset): Promise<ImageAssetSource> {
  if (source.kind === "embedded" || source.kind === "url") return source;
  const value = await resolve(source);
  if (typeof value === "string") {
    if (!value.startsWith("data:")) throw new Error("The resolved image was not available as exportable bytes.");
    return { kind: "embedded", dataUrl: value };
  }
  return { kind: "embedded", dataUrl: await dataUrl(value) };
}

async function embedEncounter(state: EncounterState, resolve: ResolveAsset, failures: string[]) {
  if (state.backgroundImage) {
    try { state.backgroundImage.source = await embedded(state.backgroundImage.source, resolve); }
    catch { failures.push(state.backgroundImage.name); }
  }
  for (const actor of Object.values(state.actors.byId)) {
    if (!actor.image) continue;
    try { actor.image = await embedded(actor.image, resolve); }
    catch { failures.push(actor.name); }
  }
}

async function embedLibrary(state: LibraryState, resolve: ResolveAsset, failures: string[]) {
  for (const sectionId of ["backgrounds", "tokens"] as const) {
    for (const node of Object.values(state.sections[sectionId].nodesById)) {
      if (node.type !== "image" || !node.asset) continue;
      try { node.asset.source = await embedded(node.asset.source, resolve); }
      catch { failures.push(node.name); }
    }
  }
}

function assertComplete(failures: string[]) {
  if (failures.length) throw new Error(`Export could not fetch: ${[...new Set(failures)].join(", ")}. Reconnect the provider and try again.`);
}

/** Embeds provider-backed bytes in a clone so live state and history stay unchanged. */
export async function prepareWorkspaceCloudExport(value: WorkspaceExportEnvelope, resolve: ResolveAsset) {
  const result = structuredClone(value);
  const failures: string[] = [];
  await embedLibrary(result.workspace.library.state, resolve, failures);
  for (const record of result.workspace.encounters) await embedEncounter(record.state, resolve, failures);
  if (result.workspace.recoveryDraft) await embedEncounter(result.workspace.recoveryDraft.state, resolve, failures);
  assertComplete(failures);
  return result;
}

export async function prepareEncounterCloudExport(value: EncounterExportEnvelope, resolve: ResolveAsset) {
  const result = structuredClone(value);
  const failures: string[] = [];
  await embedLibrary(result.library, resolve, failures);
  await embedEncounter(result.encounter, resolve, failures);
  assertComplete(failures);
  return result;
}
