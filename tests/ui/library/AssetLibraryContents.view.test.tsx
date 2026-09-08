import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LibrarySection } from "@library/types";
import { AssetLibraryContents } from "@ui/library/AssetLibraryContents";

const imageSection: LibrarySection = {
  id: "backgrounds",
  name: "Backgrounds",
  rootId: "backgrounds-root",
  nodesById: {
    "backgrounds-root": {
      childIds: ["cavern", "forest"],
      id: "backgrounds-root",
      name: "Backgrounds",
      parentId: null,
      sectionId: "backgrounds",
      type: "folder"
    },
    cavern: {
      asset: {
        mediaType: "image/png",
        name: "cavern.png",
        source: { dataUrl: "data:image/png;base64,cavern", kind: "embedded" }
      },
      id: "cavern",
      name: "Cavern",
      parentId: "backgrounds-root",
      sectionId: "backgrounds",
      type: "image"
    },
    forest: {
      asset: {
        mediaType: "image/png",
        name: "forest.png",
        source: { dataUrl: "data:image/png;base64,forest", kind: "embedded" }
      },
      id: "forest",
      name: "Forest",
      parentId: "backgrounds-root",
      sectionId: "backgrounds",
      type: "image"
    }
  }
};

function mockHoverSupport(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    matches,
    media: query,
    removeEventListener: vi.fn()
  }));
  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

function renderContents(
  overrides: Partial<React.ComponentProps<typeof AssetLibraryContents>> = {}
) {
  return render(
    <AssetLibraryContents
      activeSection={imageSection}
      currentFolder={imageSection.nodesById[imageSection.rootId]}
      dropFolderId={null}
      onDragOverContents={vi.fn()}
      onDragOverFolder={vi.fn()}
      onPointerDownNode={vi.fn()}
      onDropOnContents={vi.fn()}
      onDropOnFolder={vi.fn()}
      onDoubleClickNode={vi.fn()}
      onEnterFolder={vi.fn()}
      onOpenContextMenu={vi.fn()}
      onSelectNode={vi.fn()}
      selectedNodeId={undefined}
      setDropFolderId={vi.fn()}
      {...overrides}
    />
  );
}

describe("AssetLibraryContents view modes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles to list mode and previews an image on desktop hover", async () => {
    const restoreMatchMedia = mockHoverSupport(true);
    const user = userEvent.setup();

    try {
      renderContents();

      await user.click(
        screen.getByRole("button", {
          name: "Switch library contents to list view"
        })
      );
      expect(
        screen.getByRole("button", {
          name: "Switch library contents to grid view"
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: "Cavern" }).querySelector("img")
      ).toHaveAttribute("draggable", "false");

      fireEvent.pointerEnter(screen.getByRole("button", { name: "Cavern" }), {
        pointerType: "mouse"
      });

      expect(screen.getByRole("img", { name: "Cavern" })).toBeInTheDocument();
      expect(screen.getByLabelText("Asset preview")).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });

  it("navigates to the parent folder from the unstyled folder-up control", async () => {
    const onEnterFolder = vi.fn();
    const nestedFolder: LibrarySection["nodesById"][string] = {
      childIds: [],
      id: "maps",
      name: "Maps",
      parentId: imageSection.rootId,
      sectionId: "backgrounds",
      type: "folder"
    };
    const user = userEvent.setup();

    renderContents({ currentFolder: nestedFolder, onEnterFolder });
    await user.click(screen.getByRole("button", { name: "Go to parent folder" }));

    expect(onEnterFolder).toHaveBeenCalledWith(imageSection.rootId);
    expect(screen.getByLabelText("Current asset library folder")).toHaveTextContent(
      "Maps"
    );
  });

  it("uses a touch hold for preview when large hover preview is unavailable", () => {
    const restoreMatchMedia = mockHoverSupport(false);
    vi.useFakeTimers();

    try {
      renderContents();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Switch library contents to list view"
        })
      );
      const item = screen.getByRole("button", { name: "Cavern" });

      fireEvent.pointerEnter(item, { pointerType: "mouse" });
      expect(screen.queryByLabelText("Asset preview")).not.toBeInTheDocument();

      fireEvent.pointerDown(item, {
        clientX: 20,
        clientY: 20,
        pointerId: 1,
        pointerType: "touch"
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByLabelText("Asset preview")).toBeInTheDocument();
      fireEvent.pointerUp(item, { pointerId: 1, pointerType: "touch" });
    } finally {
      restoreMatchMedia();
    }
  });

  it("keeps the selected image visible until a hovered image takes priority", () => {
    const restoreMatchMedia = mockHoverSupport(true);
    vi.useFakeTimers();

    try {
      renderContents({ selectedNodeId: "cavern" });
      fireEvent.click(
        screen.getByRole("button", {
          name: "Switch library contents to list view"
        })
      );

      const preview = screen.getByLabelText("Asset preview");
      expect(within(preview).getByRole("img", { name: "Cavern" })).toHaveAttribute(
        "src",
        "data:image/png;base64,cavern"
      );

      const forest = screen.getByRole("button", { name: "Forest" });
      fireEvent.pointerEnter(forest, { pointerType: "mouse" });
      expect(within(preview).getByRole("img", { name: "Forest" })).toHaveAttribute(
        "src",
        "data:image/png;base64,forest"
      );

      fireEvent.pointerLeave(forest, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(within(preview).getByRole("img", { name: "Cavern" })).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });

  it("does not clear the directory drop target when dragleave only crosses descendants", () => {
    const setDropFolderId = vi.fn();

    renderContents({ setDropFolderId });
    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });
    const child = screen.getByRole("button", { name: "Cavern" });
    vi.spyOn(contents, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => undefined
    });

    const descendantLeave = createEvent.dragLeave(contents);
    Object.defineProperty(descendantLeave, "relatedTarget", { value: child });
    fireEvent(contents, descendantLeave);
    expect(setDropFolderId).not.toHaveBeenCalled();

    fireEvent.dragLeave(contents, { clientX: 50, clientY: 50 });
    expect(setDropFolderId).not.toHaveBeenCalled();

    const surfaceLeave = createEvent.dragLeave(contents);
    Object.defineProperty(surfaceLeave, "relatedTarget", {
      value: document.body
    });
    Object.defineProperty(surfaceLeave, "clientX", { value: 101 });
    Object.defineProperty(surfaceLeave, "clientY", { value: 50 });
    fireEvent(contents, surfaceLeave);
    expect(setDropFolderId).toHaveBeenCalledWith(null);
  });
});
