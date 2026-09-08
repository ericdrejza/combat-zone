import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { uploadImage } from "@library/librarySlice";
import { loadEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";

import {
  createFolder,
  openBackgroundLibrary
} from "./AssetLibraryModal.test_support";

describe("AssetLibraryModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters the explorer while preserving matching item ancestry", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Archive");
    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["ice"], "ice-cavern.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByText("ice-cavern")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search asset library"), "ICE");

    expect(screen.getAllByText("Maps").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ice-cavern").length).toBeGreaterThan(0);
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
  });

  it("sorts folders and files alphabetically in the asset browser", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("z-folder");
    await createFolder("A-folder");
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["m"], "m-map.png", { type: "image/png" }),
          new File(["b"], "b-map.png", { type: "image/png" })
        ]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "m-map" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "b-map" })).toBeInTheDocument();
    });

    const contentButtons = within(
      screen.getByRole("group", { name: "Current directory contents" })
    ).getAllByRole("button");

    expect(contentButtons.map((button) => button.textContent)).toEqual([
      "A-folder",
      "b-map",
      "m-map",
      "z-folder"
    ]);
  });

  it("filters tokens to those used by actors in the current encounter", async () => {
    const user = await openBackgroundLibrary();
    const usedToken = uploadImage({
      asset: {
        mediaType: "image/png",
        name: "Used Goblin",
        source: { kind: "url", url: "https://example.com/goblin.png" }
      },
      parentId: "tokens-root",
      sectionId: "tokens"
    });
    const unusedToken = uploadImage({
      asset: {
        mediaType: "image/png",
        name: "Unused Knight",
        source: { kind: "url", url: "https://example.com/knight.png" }
      },
      parentId: "tokens-root",
      sectionId: "tokens"
    });

    act(() => {
      store.dispatch(usedToken);
      store.dispatch(unusedToken);
      store.dispatch(loadEncounterState(createActor(
        createEncounterState({ id: "encounter", name: "Encounter" }),
        {
          currentZoneId: "zoneless",
          id: "goblin",
          image: {
            libraryNodeId: usedToken.payload.id,
            mediaType: "image/png",
            name: "Used Goblin",
            source: { kind: "url", url: "https://example.com/goblin.png" }
          }
        }
      )));
    });

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    const filter = screen.getByRole("button", {
      name: "Show tokens used by encounter actors"
    });
    expect(filter).toHaveAttribute("aria-pressed", "false");

    await user.click(filter);

    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Used Goblin").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unused Knight")).not.toBeInTheDocument();
  });
});
