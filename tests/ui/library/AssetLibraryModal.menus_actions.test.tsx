import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(screen.getByRole("menuitem", { name: "Upload new image" })).toBeInTheDocument();

    await user.click(screen.getByText("Asset Library"));
    expect(
      screen.queryByRole("menuitem", { name: "Upload new image" })
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
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
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

    vi.spyOn(window, "prompt").mockReturnValueOnce("Battle Maps");
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(screen.getAllByText("Battle Maps").length).toBeGreaterThan(0);
    await user.click(
      within(screen.getByRole("region", { name: "Asset library contents" }))
        .getByRole("button", { name: "Battle Maps" })
    );

    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
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
});
