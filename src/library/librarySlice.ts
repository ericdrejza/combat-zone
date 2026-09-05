import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice, nanoid } from "@reduxjs/toolkit";

import type {
  LibraryImageAsset,
  LibraryNode,
  LibrarySection,
  LibrarySectionId,
  LibraryState
} from "./types";
import { LIBRARY_SECTION_IDS, LIBRARY_SECTION_LABELS } from "./types";

type SectionPayload = {
  sectionId: LibrarySectionId;
};

type CreateFolderPayload = SectionPayload & {
  name: string;
  parentId: string;
};

type UploadImagePayload = SectionPayload & {
  asset: LibraryImageAsset;
  parentId: string;
};

type ReplaceImagePayload = SectionPayload & {
  asset: LibraryImageAsset;
  nodeId: string;
  name?: string;
};

type ReplaceWithAssetLinkPayload = SectionPayload & {
  nodeId: string;
  targetId: string;
};

type CreateLinkPayload = SectionPayload & {
  name?: string;
  parentId: string;
  targetId: string;
};

type NodePayload = SectionPayload & {
  nodeId: string;
};

type RenameNodePayload = NodePayload & {
  name: string;
};

type MoveNodePayload = NodePayload & {
  targetFolderId: string;
};

function createRootNode(sectionId: LibrarySectionId): LibraryNode {
  return {
    id: `${sectionId}-root`,
    name: LIBRARY_SECTION_LABELS[sectionId],
    parentId: null,
    sectionId,
    type: "folder",
    childIds: []
  };
}

function createInitialSection(sectionId: LibrarySectionId): LibrarySection {
  const root = createRootNode(sectionId);

  return {
    id: sectionId,
    name: LIBRARY_SECTION_LABELS[sectionId],
    rootId: root.id,
    nodesById: {
      [root.id]: root
    }
  };
}

function createInitialState(): LibraryState {
  return {
    sections: Object.fromEntries(
      LIBRARY_SECTION_IDS.map((sectionId) => [
        sectionId,
        createInitialSection(sectionId)
      ])
    ) as Record<LibrarySectionId, LibrarySection>
  };
}

function getFolder(
  section: LibrarySection,
  folderId: string
): LibraryNode | undefined {
  const folder = section.nodesById[folderId];

  return folder?.type === "folder" ? folder : undefined;
}

function appendChild(section: LibrarySection, parentId: string, childId: string) {
  const parent = getFolder(section, parentId);

  if (!parent) {
    return;
  }

  parent.childIds = [...(parent.childIds ?? []), childId];
}

function removeChild(section: LibrarySection, parentId: string, childId: string) {
  const parent = getFolder(section, parentId);

  if (!parent) {
    return;
  }

  parent.childIds = (parent.childIds ?? []).filter((id) => id !== childId);
}

function isDescendant(
  section: LibrarySection,
  possibleDescendantId: string,
  ancestorId: string
): boolean {
  const visited = new Set<string>();
  let current = section.nodesById[possibleDescendantId];

  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.parentId === ancestorId) {
      return true;
    }

    current = section.nodesById[current.parentId];
  }

  // Persisted or synchronized malformed ancestry must fail closed instead of
  // trapping the reducer in a synchronous loop or extending the cycle.
  return Boolean(current?.parentId);
}

function deleteNodeTree(
  section: LibrarySection,
  nodeId: string,
  visited = new Set<string>()
) {
  const node = section.nodesById[nodeId];

  if (!node || node.id === section.rootId || visited.has(node.id)) {
    return;
  }

  visited.add(node.id);

  if (node.type === "folder") {
    for (const childId of [...(node.childIds ?? [])]) {
      deleteNodeTree(section, childId, visited);
    }
  }

  if (node.parentId) {
    removeChild(section, node.parentId, node.id);
  }

  delete section.nodesById[node.id];
}

export const librarySlice = createSlice({
  name: "library",
  initialState: createInitialState(),
  reducers: {
    loadLibraryState(_state, { payload }: PayloadAction<LibraryState>) {
      return payload;
    },
    createFolder: {
      reducer(state, { payload }: PayloadAction<CreateFolderPayload & { id: string }>) {
        const section = state.sections[payload.sectionId];
        const parent = getFolder(section, payload.parentId);
        const name = payload.name.trim();

        if (!parent || !name) {
          return;
        }

        section.nodesById[payload.id] = {
          id: payload.id,
          name,
          parentId: parent.id,
          sectionId: payload.sectionId,
          type: "folder",
          childIds: []
        };
        appendChild(section, parent.id, payload.id);
      },
      prepare(payload: CreateFolderPayload) {
        return {
          payload: {
            ...payload,
            id: nanoid()
          }
        };
      }
    },
    uploadImage: {
      reducer(state, { payload }: PayloadAction<UploadImagePayload & { id: string }>) {
        const section = state.sections[payload.sectionId];
        const parent = getFolder(section, payload.parentId);

        if (!parent || payload.sectionId === "encounters") {
          return;
        }

        section.nodesById[payload.id] = {
          id: payload.id,
          name: payload.asset.name,
          parentId: parent.id,
          sectionId: payload.sectionId,
          type: "image",
          asset: payload.asset
        };
        appendChild(section, parent.id, payload.id);
      },
      prepare(payload: UploadImagePayload) {
        return {
          payload: {
            ...payload,
            id: nanoid()
          }
        };
      }
    },
    replaceImage(state, { payload }: PayloadAction<ReplaceImagePayload>) {
      const section = state.sections[payload.sectionId];
      const node = section.nodesById[payload.nodeId];

      if (!node || node.type === "folder") {
        return;
      }

      node.type = "image";
      node.asset = {
        ...payload.asset,
        name: payload.name?.trim() || node.name
      };
      node.name = node.asset.name;
      delete node.targetId;
    },
    replaceWithAssetLink(
      state,
      { payload }: PayloadAction<ReplaceWithAssetLinkPayload>
    ) {
      const section = state.sections[payload.sectionId];
      const node = section.nodesById[payload.nodeId];
      const target = section.nodesById[payload.targetId];

      if (
        !node ||
        node.type === "folder" ||
        !target ||
        target.type !== "image" ||
        node.id === target.id
      ) {
        return;
      }

      for (const candidate of Object.values(section.nodesById)) {
        if (candidate.type === "link" && candidate.targetId === node.id) {
          candidate.targetId = target.id;
        }
      }

      node.type = "link";
      node.targetId = target.id;
      delete node.asset;
    },
    createLink: {
      reducer(state, { payload }: PayloadAction<CreateLinkPayload & { id: string }>) {
        const section = state.sections[payload.sectionId];
        const parent = getFolder(section, payload.parentId);
        const target = section.nodesById[payload.targetId];

        if (!parent || !target || target.type !== "image") {
          return;
        }

        section.nodesById[payload.id] = {
          id: payload.id,
          name: payload.name?.trim() || target.name,
          parentId: parent.id,
          sectionId: payload.sectionId,
          type: "link",
          targetId: target.id
        };
        appendChild(section, parent.id, payload.id);
      },
      prepare(payload: CreateLinkPayload) {
        return {
          payload: {
            ...payload,
            id: nanoid()
          }
        };
      }
    },
    renameNode(state, { payload }: PayloadAction<RenameNodePayload>) {
      const section = state.sections[payload.sectionId];
      const node = section.nodesById[payload.nodeId];
      const name = payload.name.trim();

      if (!node || node.id === section.rootId || !name) {
        return;
      }

      node.name = name;
      if (node.type === "image" && node.asset) {
        node.asset.name = name;
      }
    },
    deleteNode(state, { payload }: PayloadAction<NodePayload>) {
      const section = state.sections[payload.sectionId];

      deleteNodeTree(section, payload.nodeId);
    },
    moveNode(state, { payload }: PayloadAction<MoveNodePayload>) {
      const section = state.sections[payload.sectionId];
      const node = section.nodesById[payload.nodeId];
      const targetFolder = getFolder(section, payload.targetFolderId);

      if (
        !node ||
        !targetFolder ||
        node.id === section.rootId ||
        node.id === targetFolder.id ||
        node.parentId === targetFolder.id ||
        isDescendant(section, targetFolder.id, node.id)
      ) {
        return;
      }

      if (node.parentId) {
        removeChild(section, node.parentId, node.id);
      }
      node.parentId = targetFolder.id;
      appendChild(section, targetFolder.id, node.id);
    },
    resetLibraryState() {
      return createInitialState();
    }
  }
});

export const {
  createFolder,
  createLink,
  deleteNode,
  loadLibraryState,
  moveNode,
  replaceImage,
  replaceWithAssetLink,
  renameNode,
  resetLibraryState,
  uploadImage
} = librarySlice.actions;

export default librarySlice.reducer;

export function resolveLibraryAsset(
  section: LibrarySection,
  nodeId: string
): LibraryImageAsset | null {
  const node = section.nodesById[nodeId];

  if (!node) {
    return null;
  }

  if (node.type === "image") {
    return node.asset ?? null;
  }

  if (node.type === "link" && node.targetId) {
    return section.nodesById[node.targetId]?.asset ?? null;
  }

  return null;
}

/** Derives a breadcrumb from normalized parent relationships. */
export function getLibraryNodePath(
  section: LibrarySection,
  nodeId: string
): string | null {
  const names: string[] = [];
  const visited = new Set<string>();
  let node: LibraryNode | undefined = section.nodesById[nodeId];

  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    names.unshift(node.name);
    node = node.parentId ? section.nodesById[node.parentId] : undefined;
  }

  return names.length > 0 ? names.join("/") : null;
}
