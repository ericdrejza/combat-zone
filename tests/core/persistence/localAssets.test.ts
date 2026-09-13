import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  collectLocalAssetIds,
  createEmptyLibraryState,
  embedLocalAssets,
  internalizeWorkspace,
  type WorkspaceSnapshot
} from "@core/persistence";

function workspaceWithSharedEmbeddedAsset(): WorkspaceSnapshot {
  const source = { kind: "embedded" as const, dataUrl: "data:image/png;base64,c2hhcmVk" };
  const encounter = createEncounterState({ id: "encounter", name: "Encounter" });
  encounter.backgroundImage = {
    source,
    height: 100,
    mediaType: "image/png",
    name: "map.png",
    width: 100
  };
  const library = createEmptyLibraryState();
  library.sections.backgrounds.nodesById.asset = {
    id: "asset",
    name: "Map",
    parentId: "backgrounds-root",
    sectionId: "backgrounds",
    type: "image",
    asset: { height: 100, mediaType: "image/png", name: "map.png", source, width: 100 }
  };
  library.sections.backgrounds.nodesById["backgrounds-root"].childIds = ["asset"];
  return {
    manifest: { activeEncounterId: "encounter", revision: 0, schemaVersion: 2, updatedAt: 1 },
    encounters: [{ createdAt: 1, folderId: null, id: "encounter", revision: 0, state: encounter, updatedAt: 1 }],
    library: { revision: 0, state: library, updatedAt: 1 },
    recoveryDraft: { state: structuredClone(encounter), updatedAt: 1 }
  };
}

describe("local asset persistence transforms", () => {
  it("deduplicates embedded bytes across Library, encounters, and recovery", async () => {
    const internalized = await internalizeWorkspace(workspaceWithSharedEmbeddedAsset());

    expect(internalized.changed).toBe(true);
    expect(internalized.assets).toHaveLength(1);
    expect(collectLocalAssetIds(internalized.value)).toEqual(
      new Set([internalized.assets[0].assetId])
    );
    expect(internalized.value.encounters[0].state.backgroundImage?.source.kind)
      .toBe("local_asset");
  });

  it("embeds each repository blob once when creating a portable export", async () => {
    const internalized = await internalizeWorkspace(workspaceWithSharedEmbeddedAsset());
    const resolve = vi.fn(async () => internalized.assets[0].blob);
    const portable = await embedLocalAssets(internalized.value, resolve);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(portable.encounters[0].state.backgroundImage?.source)
      .toEqual({ kind: "embedded", dataUrl: "data:image/png;base64,c2hhcmVk" });
    expect(portable.recoveryDraft?.state.backgroundImage?.source.kind).toBe("embedded");
    const libraryNode = portable.library.state.sections.backgrounds.nodesById.asset;
    expect(libraryNode.type === "image" ? libraryNode.asset?.source.kind : null)
      .toBe("embedded");
  });
});
