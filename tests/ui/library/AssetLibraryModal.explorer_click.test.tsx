import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFolder,
  openBackgroundLibrary
} from "./AssetLibraryModal.test_support";

function currentFolderName() {
  return within(
    screen.getByRole("region", { name: "Asset library contents" })
  ).getByLabelText("Current asset library folder").textContent;
}

describe("AssetLibraryModal explorer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps expanded folders open when their name makes them current", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");

    expect(currentFolderName()).toBe("Backgrounds");
    expect(document.querySelector("svg.lucide-folder-open-dot")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Maps" }));

    expect(currentFolderName()).toBe("Backgrounds");
    expect(screen.getByRole("button", { name: "Collapse Maps" })).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-folder-open")).toBeInTheDocument();

    await user.click(screen.getAllByText("Maps")[0]);

    expect(currentFolderName()).toBe("Maps");
    expect(screen.getByRole("button", { name: "Collapse Maps" })).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-folder-open-dot")).toBeInTheDocument();

    await createFolder("Nested");
    await user.click(screen.getAllByText("Maps")[0]);

    expect(screen.getByRole("button", { name: "Collapse Maps" })).toBeInTheDocument();
    expect(screen.getAllByText("Nested").length).toBeGreaterThan(1);
  });

  it("uses pointer dragging rather than native dragging for tree rows", async () => {
    const user = await openBackgroundLibrary();
    await createFolder("Archive");
    await createFolder("Maps");
    const mapsRow = screen.getAllByText("Maps")[0].closest(
      "[data-library-drag-node-id]"
    );
    const archiveRow = screen.getAllByText("Archive")[0].closest(
      "[data-library-drag-node-id]"
    );

    expect(mapsRow).not.toBeNull();
    expect(archiveRow).not.toBeNull();
    expect(mapsRow).toHaveAttribute("draggable", "false");
    expect(archiveRow).toHaveAttribute("draggable", "false");
  });
});
