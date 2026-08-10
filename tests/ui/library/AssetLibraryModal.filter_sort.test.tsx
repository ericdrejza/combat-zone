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

  it("filters the explorer while preserving matching item ancestry", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Archive");
    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
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
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
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
      screen.getByRole("region", { name: "Asset library contents" })
    ).getAllByRole("button");

    expect(contentButtons.map((button) => button.textContent)).toEqual([
      "A-folder",
      "b-map",
      "m-map",
      "z-folder"
    ]);
  });
});
