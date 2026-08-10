import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import { dataTransfer, dropOnCanvas } from "./LibraryPanel.test_support";

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
    expect(asset.parentElement).toHaveClass("grid-cols-2");
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
      expect(screen.getByLabelText("Canvas background image")).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "scout-token" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });
});
