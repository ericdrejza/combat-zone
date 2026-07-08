import reducer, {
  createFolder,
  createLink,
  deleteNode,
  moveNode,
  renameNode,
  resolveLibraryAsset,
  uploadImage
} from "./librarySlice";
import type { LibraryState } from "./types";

function getOnlyChildId(state: LibraryState, parentId: string): string {
  const childIds = state.sections.backgrounds.nodesById[parentId].childIds ?? [];

  expect(childIds).toHaveLength(1);

  return childIds[0];
}

const imageAsset = {
  dataUrl: "data:image/png;base64,ZmFrZQ==",
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
});
