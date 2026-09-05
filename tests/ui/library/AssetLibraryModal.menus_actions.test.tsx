import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { uploadImage } from "@library/librarySlice";
import {
  loadEncounterState,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import {
  createFolder,
  openBackgroundLibrary
} from "./AssetLibraryModal.test_support";

describe("AssetLibraryModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides add and asset menus when clicking outside them", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    expect(screen.getByRole("menuitem", { name: "Upload Image" })).toBeInTheDocument();

    await user.click(screen.getByText("Asset Library"));
    expect(
      screen.queryByRole("menuitem", { name: "Upload Image" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Maps actions" }));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();

    await user.click(screen.getByText("Asset Library"));
    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
  });

  it("confirms before deleting non-empty folders", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["map"], "nested-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByText("nested-map")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open Maps actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const confirmDialog = screen.getByRole("dialog", {
      name: "Confirm folder deletion"
    });

    expect(confirmDialog).toHaveTextContent("This folder isn't empty.");

    await user.click(within(confirmDialog).getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("dialog", { name: "Confirm folder deletion" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Maps actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Confirm folder deletion" }))
        .getByRole("button", { name: "Delete" })
    );

    expect(screen.queryByText("Maps")).not.toBeInTheDocument();
  });

  it("opens rename and delete actions from asset cards", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");

    const folderCard = screen.getByRole("button", { name: "Maps" });

    fireEvent.contextMenu(folderCard);
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const renameInput = screen.getByRole("textbox", {
      name: "New library item name"
    });
    await user.clear(renameInput);
    await user.type(renameInput, "Battle Maps");
    await user.click(
      within(screen.getByRole("dialog", { name: "Rename Maps" })).getByRole(
        "button",
        { name: "Rename" }
      )
    );

    expect(screen.getAllByText("Battle Maps").length).toBeGreaterThan(0);
    await user.click(
      within(screen.getByRole("region", { name: "Asset library contents" }))
        .getByRole("button", { name: "Battle Maps" })
    );

    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["map"], "card-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "card-map" })).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: "card-map" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(
      screen.queryByRole("button", { name: "card-map" })
    ).not.toBeInTheDocument();
  });

  it("does not enter a folder when opening its context menu", async () => {
    await openBackgroundLibrary();
    await createFolder("Maps");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Maps" }));

    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(
      within(contents).getByLabelText("Current asset library folder")
    ).toHaveTextContent("Backgrounds");
  });

  it("opens asset type choices beside an image asset", async () => {
    const user = await openBackgroundLibrary();
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["map"], "card-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "card-map" })).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: "card-map" }));
    await user.click(screen.getByRole("menuitem", { name: "Change source" }));

    const assetTypes = screen.getByRole("menu", { name: "Asset types" });
    expect(within(assetTypes).getByRole("menuitem", { name: "Upload Image" })).toBeInTheDocument();
    expect(within(assetTypes).getByRole("menuitem", { name: "Web link" })).toBeInTheDocument();
    expect(within(assetTypes).getByRole("menuitem", { name: "Link from Google Drive" })).toBeDisabled();
    expect(within(assetTypes).getByRole("menuitem", { name: "Link asset" })).toBeDisabled();

    await user.click(within(assetTypes).getByRole("menuitem", { name: "Web link" }));
    const webLinkDialog = screen.getByRole("dialog", { name: "Link image URL" });
    expect(within(webLinkDialog).queryByLabelText("Image name")).not.toBeInTheDocument();
  });

  it("updates and history-tracks actors that reference a changed token source", async () => {
    const user = await openBackgroundLibrary();
    const originalSource = {
      kind: "url" as const,
      url: "https://example.com/original.png"
    };
    const addToken = uploadImage({
      asset: {
        mediaType: "image/png",
        name: "Goblin",
        source: originalSource
      },
      parentId: "tokens-root",
      sectionId: "tokens"
    });

    act(() => {
      store.dispatch(addToken);
      store.dispatch(loadEncounterState(createActor(
        createEncounterState({ id: "encounter", name: "Encounter" }),
        {
          currentZoneId: "zoneless",
          id: "goblin-actor",
          image: {
            libraryNodeId: addToken.payload.id,
            mediaType: "image/png",
            name: "Goblin",
            source: originalSource
          }
        }
      )));
    });

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    fireEvent.contextMenu(screen.getByRole("button", { name: "Goblin" }));
    await user.click(screen.getByRole("menuitem", { name: "Change source" }));
    await user.click(
      within(screen.getByRole("menu", { name: "Asset types" }))
        .getByRole("menuitem", { name: "Web link" })
    );
    await user.type(
      screen.getByRole("textbox", { name: "Image URL" }),
      "https://example.com/replacement.webp"
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Link image URL" }))
        .getByRole("button", { name: "Add image" })
    );

    await waitFor(() => {
      expect(store.getState().encounter.present.actors.byId["goblin-actor"]?.image)
        .toEqual({
          kind: "url",
          url: "https://example.com/replacement.webp"
        });
    });
    expect(store.getState().encounter.past).toHaveLength(1);

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId["goblin-actor"]?.image)
      .toEqual(originalSource);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId["goblin-actor"]?.image)
      .toEqual({
        kind: "url",
        url: "https://example.com/replacement.webp"
      });
  });
});
