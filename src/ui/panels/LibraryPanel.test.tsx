import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@test/ui/renderApp";

function dataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      types.push(type);
    },
    setDragImage: () => undefined,
    types
  };
}

function dropOnCanvas(
  canvas: HTMLElement,
  transfer: ReturnType<typeof dataTransfer>,
  clientX: number,
  clientY: number
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: transfer }
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}

describe("LibraryPanel", () => {
  it("toggles between list and two-column grid views", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        uploadImage({
          asset: {
            dataUrl: "data:image/png;base64,scout",
            mediaType: "image/png",
            name: "Scout"
          },
          parentId: "tokens-root",
          sectionId: "tokens"
        })
      );
    });

    const libraryPanel = screen.getByRole("region", { name: "Library panel" });
    const toggle = within(libraryPanel).getByRole("button", {
      name: "Switch Library to grid view"
    });
    const reorder = within(libraryPanel).getByRole("button", {
      name: "Reorder Library panel"
    });

    expect(
      toggle.compareDocumentPosition(reorder) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(toggle);

    const asset = within(libraryPanel).getByRole("button", { name: "Scout" });
    expect(
      asset.parentElement
    ).toHaveClass("grid-cols-2");
    expect(asset).toHaveClass("flex-col");
    expect(
      within(libraryPanel).getByRole("button", {
        name: "Switch Library to list view"
      })
    ).toBeInTheDocument();

    await user.click(
      within(libraryPanel).getByRole("button", {
        name: "Switch Library to list view"
      })
    );

    expect(asset).not.toHaveClass("flex-col");
  });

  it("deselects existing actors and selects an actor created by library drag", () => {
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      const encounter = createActor(
        createEncounterState({ id: "library-drag", name: "Library Drag" }),
        {
          currentZoneId: "zoneless",
          id: "existing-actor",
          name: "Existing Actor"
        }
      );

      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seed"),
          nextEncounter: encounter
        })
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({ entityType: "actor", ids: ["existing-actor"] })
      );
      store.dispatch(
        uploadImage({
          asset: {
            dataUrl: "data:image/png;base64,scout",
            mediaType: "image/png",
            name: "Scout"
          },
          parentId: "tokens-root",
          sectionId: "tokens"
        })
      );
    });

    const token = screen.getByRole("button", { name: "Scout" });
    fireEvent.dragStart(token, { dataTransfer: transfer });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: null,
      selectedIds: []
    });

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, {
      clientX: 700,
      clientY: 500,
      dataTransfer: transfer
    });
    dropOnCanvas(canvas, transfer, 700, 500);

    const createdActor = Object.values(
      store.getState().encounter.present.actors.byId
    ).find((actor) => actor.name === "Scout");

    expect(createdActor).toBeDefined();
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: [createdActor!.id]
    });
  });

  it("shows the current folder as the first panel body item", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    await user.click(screen.getByRole("button", { name: "Add to Tokens" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["token"], "scout-token.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "scout-token"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    const libraryPanel = screen.getByRole("region", { name: "Library panel" });
    const currentFolder = within(libraryPanel).getByLabelText(
      "Current library folder"
    );
    const assetButton = within(libraryPanel).getByRole("button", {
        name: "scout-token"
      });

    expect(currentFolder).toHaveTextContent("Tokens");
    expect(
      currentFolder.compareDocumentPosition(assetButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("applies an uploaded library background to the canvas", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["background"], "battle-map.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "battle-map"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(screen.getByRole("button", { name: "battle-map" }));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Canvas background image")
      ).toBeInTheDocument();
    });
  });

  it("shows token assets when Actor is active and collapses them for Select", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    await user.click(screen.getByRole("button", { name: "Add to Tokens" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["token"], "scout-token.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "scout-token"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(
      screen.getByRole("button", { name: "scout-token" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("reopens the Library panel from Actor only when Select auto-collapsed it", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(
      screen.getByRole("button", { name: "Collapse Library panel" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the Library panel collapsed for Actor when the user collapsed it manually", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("hands a double-clicked token from the modal to the focused Actor library panel", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      store.dispatch(
        uploadImage({
          asset: {
            dataUrl: "data:image/png;base64,scout",
            mediaType: "image/png",
            name: "Scout"
          },
          parentId: "tokens-root",
          sectionId: "tokens"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Scout" }));

    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const panel = screen.getByRole("region", { name: "Library panel" });
    expect(within(panel).getByLabelText("Current library folder")).toHaveTextContent(
      "Tokens"
    );
    expect(within(panel).getByRole("button", { name: "Scout" })).toHaveFocus();
  });

  it("applies a background immediately when an image is double-clicked in the modal", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      store.dispatch(
        uploadImage({
          asset: {
            dataUrl: "data:image/png;base64,battle-map",
            mediaType: "image/png",
            name: "Battle Map"
          },
          parentId: "backgrounds-root",
          sectionId: "backgrounds"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Battle Map" }));

    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present.backgroundImage?.name).toBe("Battle Map");
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe("background.add");
  });
});
