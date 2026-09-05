import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterRecord } from "@core/persistence";
import type { LibrarySection } from "@library/types";
import { AssetLibraryContents } from "@ui/library/AssetLibraryContents";

const encountersSection: LibrarySection = {
  id: "encounters",
  name: "Encounters",
  rootId: "encounters-root",
  nodesById: {
    "encounters-root": {
      id: "encounters-root",
      name: "Encounters",
      parentId: null,
      sectionId: "encounters",
      type: "folder",
      childIds: []
    }
  }
};

function createRecord(): EncounterRecord {
  const state = createEncounterState({
    id: "preview-encounter",
    name: "Preview Encounter"
  });

  return {
    id: state.id,
    state: {
      ...state,
      backgroundImage: {
        source: { kind: "embedded", dataUrl: "data:image/png;base64,preview" },
        height: 100,
        mediaType: "image/png",
        name: "preview.png",
        width: 100
      }
    },
    folderId: null,
    revision: 0,
    createdAt: 0,
    updatedAt: 0
  };
}

function renderContents(overrides: Partial<React.ComponentProps<typeof AssetLibraryContents>> = {}) {
  return render(
    <AssetLibraryContents
      activeSection={encountersSection}
      currentFolder={encountersSection.nodesById[encountersSection.rootId]}
      dropFolderId={null}
      encounterRecords={[createRecord()]}
      onDragOverContents={vi.fn()}
      onDragOverFolder={vi.fn()}
      onPointerDownNode={vi.fn()}
      onDropOnContents={vi.fn()}
      onDropOnFolder={vi.fn()}
      onDoubleClickNode={vi.fn()}
      onEnterFolder={vi.fn()}
      onOpenContextMenu={vi.fn()}
      onSelectNode={vi.fn()}
      setDropFolderId={vi.fn()}
      {...overrides}
      selectedNodeId={overrides.selectedNodeId}
    />
  );
}

describe("AssetLibraryContents encounter cards", () => {
  it("uses the active background as the preview and exposes actions from the context menu", () => {
    const onExportEncounter = vi.fn();
    renderContents({ onExportEncounter });

    const card = screen.getByRole("button", { name: "Preview Encounter" });
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,preview"
    );
    expect(
      within(screen.getByRole("region", { name: "Asset library contents" })).queryByRole(
        "button",
        { name: "Export Preview Encounter" }
      )
    ).not.toBeInTheDocument();

    fireEvent.contextMenu(card, { clientX: 80, clientY: 120 });
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));
    expect(onExportEncounter).toHaveBeenCalledWith(
      "preview-encounter",
      "Preview Encounter"
    );
  });

  it("disables mutating encounter actions in read-only mode and dismisses on outside click", () => {
    renderContents({ readOnly: true });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Preview Encounter" }));

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Export" })).not.toBeDisabled();

    fireEvent.pointerDown(screen.getByRole("region", { name: "Asset library contents" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("requests the shared rename flow from the context menu", () => {
    const onRequestRenameEncounter = vi.fn();
    renderContents({ onRequestRenameEncounter });

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "Preview Encounter" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(onRequestRenameEncounter).toHaveBeenCalledWith(
      "preview-encounter",
      "Preview Encounter"
    );
  });
});
