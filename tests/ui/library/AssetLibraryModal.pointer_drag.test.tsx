import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFolder as createFolderAction,
  uploadImage
} from "@library/librarySlice";
import { store } from "@store/store";
import { openBackgroundLibrary } from "./AssetLibraryModal.test_support";

function pointerDrag(source: Element, target: Element, pointerId: number) {
  const elementFromPoint = Object.getOwnPropertyDescriptor(
    document,
    "elementFromPoint"
  );
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => target)
  });

  try {
    fireEvent.pointerDown(source, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      buttons: 1,
      clientX: 30,
      clientY: 30,
      pointerId,
      pointerType: "mouse"
    });
    expect(screen.getByRole("status", { name: /^Dragging / })).toBeInTheDocument();
    fireEvent.pointerUp(window, {
      button: 0,
      clientX: 30,
      clientY: 30,
      pointerId,
      pointerType: "mouse"
    });
  } finally {
    if (elementFromPoint) {
      Object.defineProperty(document, "elementFromPoint", elementFromPoint);
    } else {
      delete (document as Partial<Document>).elementFromPoint;
    }
  }
}

describe("AssetLibraryModal pointer node dragging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("moves folder cards, list items, and file-tree assets without native dragging", async () => {
    const user = await openBackgroundLibrary();
    const section = store.getState().library.sections.backgrounds;
    const maps = createFolderAction({
      name: "Maps",
      parentId: section.rootId,
      sectionId: "backgrounds"
    });
    const archive = createFolderAction({
      name: "Archive",
      parentId: section.rootId,
      sectionId: "backgrounds"
    });
    const image = uploadImage({
      asset: {
        mediaType: "image/png",
        name: "Cavern",
        source: { dataUrl: "data:image/png;base64,cavern", kind: "embedded" }
      },
      parentId: section.rootId,
      sectionId: "backgrounds"
    });

    act(() => {
      store.dispatch(maps);
      store.dispatch(archive);
      store.dispatch(image);
    });

    const contents = screen.getByRole("group", {
      name: "Current directory contents"
    });
    const mapsCard = within(contents).getByRole("button", { name: "Maps" });
    const archiveCard = within(contents).getByRole("button", {
      name: "Archive"
    });
    expect(mapsCard).toHaveAttribute("draggable", "false");
    pointerDrag(mapsCard, archiveCard, 1);
    expect(
      store.getState().library.sections.backgrounds.nodesById[maps.payload.id]
        .parentId
    ).toBe(archive.payload.id);

    await user.click(
      screen.getByRole("button", {
        name: "Switch library contents to list view"
      })
    );
    const imageListItem = within(contents).getByRole("button", {
      name: "Cavern"
    });
    expect(imageListItem).toHaveAttribute("draggable", "false");
    pointerDrag(imageListItem, archiveCard, 2);
    expect(
      store.getState().library.sections.backgrounds.nodesById[image.payload.id]
        .parentId
    ).toBe(archive.payload.id);

    await user.click(screen.getByRole("button", { name: "Expand Archive" }));
    const treeImage = document.querySelector(
      `[data-library-drag-node-id="${image.payload.id}"]:not(button)`
    );
    const rootTreeRow = document.querySelector(
      `[data-library-drop-folder-id="${section.rootId}"]`
    );
    expect(treeImage).not.toBeNull();
    expect(treeImage).toHaveAttribute("draggable", "false");
    expect(rootTreeRow).not.toBeNull();
    pointerDrag(treeImage as Element, rootTreeRow as Element, 3);
    expect(
      store.getState().library.sections.backgrounds.nodesById[image.payload.id]
        .parentId
    ).toBe(section.rootId);
    expect(screen.queryByRole("status", { name: /^Dragging / })).not.toBeInTheDocument();
  });
});
