import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragDataTransfer,
  createFolder,
  openBackgroundLibrary
} from "./AssetLibraryModal.test_support";

describe("AssetLibraryModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads multiple images into the selected folder", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["a"], "map-a.png", { type: "image/png" }),
          new File(["b"], "map-b.png", { type: "image/png" })
        ]
      }
    });

    await waitFor(() => {
      expect(screen.getByText("map-a")).toBeInTheDocument();
      expect(screen.getByText("map-b")).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
        "Maps"
      ).length
    ).toBeGreaterThan(0);
  });

  it("adds new folders as siblings when an asset is selected", async () => {
    const user = await openBackgroundLibrary();

    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["base"], "base-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "base-map" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "base-map" }));
    vi.spyOn(window, "prompt").mockReturnValueOnce("Siblings");
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Create new folder" }));

    expect(screen.getByRole("button", { name: "base-map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siblings" })).toBeInTheDocument();
  });

  it("uploads dropped image files into the current folder", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));

    fireEvent.drop(
      screen.getByRole("region", { name: "Asset library contents" }),
      {
        dataTransfer: {
          files: [new File(["drop"], "dropped-map.png", { type: "image/png" })],
          items: [],
          types: ["Files"]
        }
      }
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "dropped-map" })
      ).toBeInTheDocument();
    });
  });

  it("moves existing library assets when dropped onto a folder", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["move"], "move-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "move-map" })).toBeInTheDocument();
    });

    const dataTransfer = createDragDataTransfer();

    fireEvent.dragStart(screen.getByRole("button", { name: "move-map" }), {
      dataTransfer
    });
    fireEvent.drop(screen.getByRole("button", { name: "Maps" }), {
      dataTransfer
    });

    const contents = screen.getByRole("region", {
      name: "Asset library contents"
    });

    expect(
      within(contents).queryByRole("button", { name: "move-map" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Maps" }));

    expect(
      within(contents).getByRole("button", { name: "move-map" })
    ).toBeInTheDocument();
  });
});
