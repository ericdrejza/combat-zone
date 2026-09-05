import reducer, {
  createFolder,
  createLink,
  deleteNode,
  getLibraryNodePath,
  moveNode,
  replaceImage,
  replaceWithAssetLink,
  renameNode,
  resolveLibraryAsset,
  uploadImage
} from "@library/librarySlice";
import type { LibraryState } from "@library/types";

function getOnlyChildId(state: LibraryState, parentId: string): string {
  const childIds = state.sections.backgrounds.nodesById[parentId].childIds ?? [];

  expect(childIds).toHaveLength(1);

  return childIds[0];
}

const imageAsset = {
  source: { kind: "embedded" as const, dataUrl: "data:image/png;base64,ZmFrZQ==" },
  mediaType: "image/png",
  name: "map.png"
};

describe("librarySlice", () => {
  it("creates, renames, moves, and deletes folders", () => {
    let state = reducer(undefined, createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const folderId = getOnlyChildId(state, "backgrounds-root");

    state = reducer(state, renameNode({
      name: "Battle Maps",
      nodeId: folderId,
      sectionId: "backgrounds"
    }));

    expect(state.sections.backgrounds.nodesById[folderId].name).toBe(
      "Battle Maps"
    );

    state = reducer(state, createFolder({
      name: "Archive",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const archiveId = state.sections.backgrounds.nodesById[
      "backgrounds-root"
    ].childIds?.find((id) => id !== folderId) as string;

    state = reducer(state, moveNode({
      nodeId: folderId,
      sectionId: "backgrounds",
      targetFolderId: archiveId
    }));

    expect(
      state.sections.backgrounds.nodesById[archiveId].childIds
    ).toContain(folderId);
    expect(
      state.sections.backgrounds.nodesById["backgrounds-root"].childIds
    ).not.toContain(folderId);

    state = reducer(state, deleteNode({
      nodeId: archiveId,
      sectionId: "backgrounds"
    }));

    expect(state.sections.backgrounds.nodesById[archiveId]).toBeUndefined();
    expect(state.sections.backgrounds.nodesById[folderId]).toBeUndefined();
  });

  it("prevents moving a folder into its own descendant", () => {
    let state = reducer(undefined, createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const folderId = getOnlyChildId(state, "backgrounds-root");

    state = reducer(state, createFolder({
      name: "Nested",
      parentId: folderId,
      sectionId: "backgrounds"
    }));
    const nestedId = getOnlyChildId(state, folderId);

    const nextState = reducer(state, moveNode({
      nodeId: folderId,
      sectionId: "backgrounds",
      targetFolderId: nestedId
    }));

    expect(nextState).toEqual(state);
  });

  it("fails closed instead of looping when persisted folder ancestry is cyclic", () => {
    let state = reducer(undefined, createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const mapsId = getOnlyChildId(state, "backgrounds-root");

    state = reducer(state, createFolder({
      name: "Archive",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const archiveId = state.sections.backgrounds.nodesById[
      "backgrounds-root"
    ].childIds?.find((id) => id !== mapsId) as string;
    state = reducer(state, uploadImage({
      asset: imageAsset,
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const imageId = state.sections.backgrounds.nodesById[
      "backgrounds-root"
    ].childIds?.find((id) => id !== mapsId && id !== archiveId) as string;
    const malformedState = structuredClone(state);
    malformedState.sections.backgrounds.nodesById[mapsId].parentId = archiveId;
    malformedState.sections.backgrounds.nodesById[archiveId].parentId = mapsId;

    const nextState = reducer(malformedState, moveNode({
      nodeId: imageId,
      sectionId: "backgrounds",
      targetFolderId: mapsId
    }));

    expect(
      nextState.sections.backgrounds.nodesById[imageId].parentId
    ).toBe("backgrounds-root");
  });

  it("uploads images and creates same-section links to them", () => {
    let state = reducer(undefined, uploadImage({
      asset: imageAsset,
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const imageId = getOnlyChildId(state, "backgrounds-root");

    state = reducer(state, createFolder({
      name: "Favorites",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const folderId = state.sections.backgrounds.nodesById[
      "backgrounds-root"
    ].childIds?.find((id) => id !== imageId) as string;

    state = reducer(state, createLink({
      parentId: folderId,
      sectionId: "backgrounds",
      targetId: imageId
    }));
    const linkId = getOnlyChildId(state, folderId);

    expect(state.sections.backgrounds.nodesById[linkId]).toMatchObject({
      name: "map.png",
      targetId: imageId,
      type: "link"
    });
    expect(resolveLibraryAsset(state.sections.backgrounds, linkId)).toEqual(
      imageAsset
    );
  });

  it("replaces an image without changing its node id or its links", () => {
    let state = reducer(undefined, uploadImage({
      asset: imageAsset,
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const imageId = getOnlyChildId(state, "backgrounds-root");
    state = reducer(state, createFolder({
      name: "Favorites",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const folderId = state.sections.backgrounds.nodesById["backgrounds-root"]
      .childIds?.find((id) => id !== imageId) as string;
    state = reducer(state, createLink({
      parentId: folderId,
      sectionId: "backgrounds",
      targetId: imageId
    }));
    const linkId = getOnlyChildId(state, folderId);
    const replacement = {
      ...imageAsset,
      name: "replacement.png",
      source: { kind: "embedded" as const, dataUrl: "data:image/png;base64,new" }
    };

    state = reducer(state, replaceImage({
      asset: replacement,
      name: "map.png",
      nodeId: imageId,
      sectionId: "backgrounds"
    }));

    expect(state.sections.backgrounds.nodesById[imageId]).toMatchObject({
      id: imageId,
      name: "map.png",
      type: "image"
    });
    expect(resolveLibraryAsset(state.sections.backgrounds, linkId)).toEqual({
      ...replacement,
      name: "map.png"
    });
  });

  it("changes an asset to an asset link without changing its node id", () => {
    let state = reducer(undefined, uploadImage({
      asset: imageAsset,
      parentId: "tokens-root",
      sectionId: "tokens"
    }));
    const sourceId = state.sections.tokens.nodesById["tokens-root"].childIds?.[0] as string;
    state = reducer(state, createLink({
      parentId: "tokens-root",
      sectionId: "tokens",
      targetId: sourceId
    }));
    const sourceAliasId = state.sections.tokens.nodesById["tokens-root"]
      .childIds?.[1] as string;
    state = reducer(state, uploadImage({
      asset: {
        ...imageAsset,
        name: "other.png",
        source: { kind: "embedded", dataUrl: "data:image/png;base64,other" }
      },
      parentId: "tokens-root",
      sectionId: "tokens"
    }));
    const targetId = state.sections.tokens.nodesById["tokens-root"].childIds?.[2] as string;

    state = reducer(state, replaceWithAssetLink({
      nodeId: sourceId,
      sectionId: "tokens",
      targetId
    }));

    expect(state.sections.tokens.nodesById[sourceId]).toMatchObject({
      id: sourceId,
      type: "link",
      targetId
    });
    expect(resolveLibraryAsset(state.sections.tokens, sourceId)).toEqual(
      state.sections.tokens.nodesById[targetId].asset
    );
    expect(state.sections.tokens.nodesById[sourceAliasId]).toMatchObject({
      targetId,
      type: "link"
    });
    expect(resolveLibraryAsset(state.sections.tokens, sourceAliasId)).toEqual(
      state.sections.tokens.nodesById[targetId].asset
    );
  });

  it("ignores image uploads for the Encounters section", () => {
    const state = reducer(undefined, uploadImage({
      asset: imageAsset,
      parentId: "encounters-root",
      sectionId: "encounters"
    }));

    expect(
      state.sections.encounters.nodesById["encounters-root"].childIds
    ).toEqual([]);
  });

  it("derives a library path from normalized folder parents", () => {
    let state = reducer(undefined, createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const folderId = getOnlyChildId(state, "backgrounds-root");

    state = reducer(state, uploadImage({
      asset: imageAsset,
      parentId: folderId,
      sectionId: "backgrounds"
    }));
    const imageId = getOnlyChildId(state, folderId);

    expect(getLibraryNodePath(state.sections.backgrounds, imageId)).toBe(
      "Backgrounds/Maps/map.png"
    );
  });
});
