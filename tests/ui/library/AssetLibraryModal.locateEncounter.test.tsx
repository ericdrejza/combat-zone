import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterRecord } from "@core/persistence";
import { loadLibraryState, resetLibraryState } from "@library/librarySlice";
import type { LibraryState } from "@library/types";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { AssetLibraryModal } from "@ui/library/AssetLibraryModal";
import {
  PersistenceContext,
  type PersistenceContextValue
} from "@ui/persistence/PersistenceContext";

const encounterRecord: EncounterRecord = {
  id: "active-encounter",
  state: createEncounterState({
    id: "active-encounter",
    name: "Active Encounter"
  }),
  folderId: "folder-b",
  revision: 0,
  createdAt: 0,
  updatedAt: 0
};

function createFolder(
  id: string,
  name: string,
  parentId: string | null,
  childIds: string[]
) {
  return {
    id,
    name,
    parentId,
    sectionId: "encounters" as const,
    type: "folder" as const,
    childIds
  };
}

function createLibraryState(): LibraryState {
  return {
    sections: {
      encounters: {
        id: "encounters",
        name: "Encounters",
        rootId: "encounters-root",
        nodesById: {
          "encounters-root": createFolder(
            "encounters-root",
            "Encounters",
            null,
            ["folder-a"]
          ),
          "folder-a": createFolder("folder-a", "A", "encounters-root", ["folder-b"]),
          "folder-b": createFolder("folder-b", "B", "folder-a", [])
        }
      },
      backgrounds: {
        id: "backgrounds",
        name: "Backgrounds",
        rootId: "backgrounds-root",
        nodesById: {
          "backgrounds-root": {
            id: "backgrounds-root",
            name: "Backgrounds",
            parentId: null,
            sectionId: "backgrounds",
            type: "folder",
            childIds: ["background-folder"]
          },
          "background-folder": {
            id: "background-folder",
            name: "Background folder",
            parentId: "backgrounds-root",
            sectionId: "backgrounds",
            type: "folder",
            childIds: ["background-node"]
          },
          "background-node": {
            id: "background-node",
            name: "Battle Map",
            parentId: "background-folder",
            sectionId: "backgrounds",
            type: "image",
            asset: {
              source: {
                kind: "embedded",
                dataUrl: "data:image/png;base64,battle-map"
              },
              mediaType: "image/png",
              name: "Battle Map"
            }
          }
        }
      },
      tokens: {
        id: "tokens",
        name: "Tokens",
        rootId: "tokens-root",
        nodesById: {
          "tokens-root": {
            id: "tokens-root",
            name: "Tokens",
            parentId: null,
            sectionId: "tokens",
            type: "folder",
            childIds: []
          }
        }
      }
    }
  };
}

function createPersistenceValue(): PersistenceContextValue {
  const unusedExport = async (): Promise<never> => {
    throw new Error("unused test export");
  };

  return {
    activeRecord: encounterRecord,
    createNewEncounter: async () => undefined,
    deleteEncounter: async () => false,
    duplicateEncounter: async () => undefined,
    encounters: [encounterRecord],
    exportEncounter: unusedExport,
    exportWorkspace: unusedExport,
    importEncounter: async () => undefined,
    importWorkspace: async () => undefined,
    initialized: true,
    loadEncounter: async () => undefined,
    moveEncounter: async () => undefined,
    readOnly: false,
    renameEncounter: async () => undefined,
    reloadFromRepository: async () => undefined,
    resetLocalData: async () => undefined,
    save: async () => "saved",
    saveStatus: "saved"
  };
}

function ModalHarness() {
  const [currentFolderBySection, setCurrentFolderBySection] = useState<
    Partial<Record<"encounters" | "backgrounds" | "tokens", string>>
  >({});

  return (
    <AssetLibraryModal
      currentFolderBySection={currentFolderBySection}
      onBackgroundDoubleClick={vi.fn()}
      onClose={vi.fn()}
      onCurrentFolderChange={(sectionId, folderId) => {
        setCurrentFolderBySection((current) => ({
          ...current,
          [sectionId]: folderId
        }));
      }}
      onTokenDoubleClick={vi.fn()}
    />
  );
}

function pointerDrag(
  source: Element,
  target: Element,
  whileDragging?: () => void
) {
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
      pointerId: 1,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      buttons: 1,
      clientX: 30,
      clientY: 30,
      pointerId: 1,
      pointerType: "mouse"
    });
    whileDragging?.();
    fireEvent.pointerUp(window, {
      button: 0,
      clientX: 30,
      clientY: 30,
      pointerId: 1,
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

describe("AssetLibraryModal active encounter locator", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let originalScrollDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    act(() => {
      store.dispatch(resetLibraryState());
      store.dispatch(loadLibraryState(createLibraryState()));
      store.dispatch(loadEncounterState(encounterRecord.state));
    });
    originalScrollDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView"
    );
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
  });

  afterEach(() => {
    if (originalScrollDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollDescriptor
      );
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    }
    vi.restoreAllMocks();
  });

  it("expands the active encounter path, navigates there, and scrolls to its card", async () => {
    const user = userEvent.setup();

    renderWithPersistence();
    expect(screen.queryByText("Active Encounter")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Locate active encounter" }));

    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });
    expect(
      within(contents).getByLabelText("Current asset library folder")
    ).toHaveTextContent("B");
    expect(screen.getByRole("button", { name: "Collapse A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse B" })).toBeInTheDocument();
    expect(within(contents).getByRole("button", { name: "Active Encounter" })).toBeInTheDocument();
    expect(screen.getAllByText("Active Encounter").length).toBeGreaterThan(1);
    const openEncounterButton = screen.getByRole("button", {
      name: "Open Encounter"
    });
    expect(openEncounterButton).toBeDisabled();
    await user.click(
      within(contents).getByRole("button", { name: "Active Encounter" })
    );
    expect(openEncounterButton).toBeEnabled();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

    scrollIntoView.mockClear();
    await user.click(screen.getByRole("button", { name: "Collapse A" }));
    await user.click(screen.getByRole("button", { name: "Locate current directory" }));
    expect(screen.getByRole("button", { name: "Collapse B" })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("navigates to an encounter's folder when selecting it from the explorer", async () => {
    const user = userEvent.setup();

    renderWithPersistence();
    await user.click(screen.getByRole("button", { name: "Expand A" }));
    await user.click(screen.getByRole("button", { name: "Expand B" }));

    await user.click(screen.getAllByText("Active Encounter")[0]);

    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });
    expect(
      within(contents).getByLabelText("Current asset library folder")
    ).toHaveTextContent("B");
    expect(
      within(contents).getByRole("button", { name: "Active Encounter" })
    ).toBeInTheDocument();
  });

  it("opens the shared encounter actions from an encounter tree item", async () => {
    const user = userEvent.setup();
    const duplicateEncounter = vi.fn().mockResolvedValue(undefined);

    renderWithPersistence({
      ...createPersistenceValue(),
      duplicateEncounter
    });
    await user.click(screen.getByRole("button", { name: "Expand A" }));
    await user.click(screen.getByRole("button", { name: "Expand B" }));

    const actionsButton = screen.getByRole("button", {
      name: "Open Active Encounter actions"
    });
    await user.click(actionsButton);

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(duplicateEncounter).toHaveBeenCalledWith("active-encounter");
  });

  it("moves an encounter card to a folder with the shared pointer drag", async () => {
    const user = userEvent.setup();
    const moveEncounter = vi.fn().mockResolvedValue(undefined);

    renderWithPersistence({
      ...createPersistenceValue(),
      moveEncounter
    });
    await user.click(screen.getByRole("button", { name: "Locate active encounter" }));

    const card = screen.getByRole("button", { name: "Active Encounter" });
    const targetFolder = screen.getAllByText("A")[0].closest(
      "[data-library-drop-folder-id]"
    );

    expect(card.closest("[draggable]")).toHaveAttribute("draggable", "false");
    expect(targetFolder).not.toBeNull();
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    pointerDrag(card, targetFolder as Element, () => {
      expect(card.closest("[data-dragging]")).toHaveAttribute(
        "data-dragging",
        "true"
      );
      expect(card).toHaveAttribute("aria-pressed", "false");
    });

    expect(moveEncounter).toHaveBeenCalledWith("active-encounter", "folder-a");
    expect(card.closest("[data-dragging]")).not.toBeInTheDocument();
  });

  it("moves an encounter tree item with the shared pointer drag", async () => {
    const user = userEvent.setup();
    const moveEncounter = vi.fn().mockResolvedValue(undefined);

    renderWithPersistence({
      ...createPersistenceValue(),
      moveEncounter
    });
    await user.click(screen.getByRole("button", { name: "Locate active encounter" }));

    const treeItem = document.querySelector(
      '[data-library-drag-encounter-id="active-encounter"]'
    );
    const targetFolder = screen.getAllByText("A")[0].closest(
      "[data-library-drop-folder-id]"
    );

    expect(treeItem).toHaveAttribute("draggable", "false");
    expect(targetFolder).not.toBeNull();
    pointerDrag(treeItem as Element, targetFolder as Element);

    expect(moveEncounter).toHaveBeenCalledWith("active-encounter", "folder-a");
  });

  it("locates the active background from the Backgrounds tab", async () => {
    const user = userEvent.setup();
    const backgroundedEncounter = {
      ...encounterRecord.state,
      backgroundImage: {
        source: {
          kind: "embedded" as const,
          dataUrl: "data:image/png;base64,battle-map"
        },
        height: 100,
        libraryNodeId: "background-node",
        mediaType: "image/png",
        name: "Battle Map",
        width: 100
      }
    };

    act(() => {
      store.dispatch(loadEncounterState(backgroundedEncounter));
    });
    renderWithPersistence();
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    await user.click(screen.getByRole("button", { name: "Locate active background" }));

    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });
    expect(
      within(contents).getByLabelText("Current asset library folder")
    ).toHaveTextContent("Background folder");
    expect(within(contents).getByRole("button", { name: "Battle Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Background folder" })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});

function renderWithPersistence(
  persistence: PersistenceContextValue = createPersistenceValue()
) {
  return render(
    <Provider store={store}>
      <PersistenceContext.Provider value={persistence}>
        <ModalHarness />
      </PersistenceContext.Provider>
    </Provider>
  );
}
