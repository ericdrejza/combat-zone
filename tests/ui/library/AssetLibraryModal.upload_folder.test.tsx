import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFolder,
  openBackgroundLibrary
} from "./AssetLibraryModal.test_support";

function pointerDrag(source: Element, target: Element) {
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

describe("AssetLibraryModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads multiple images into the selected folder", async () => {
    const user = await openBackgroundLibrary();

    await createFolder("Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));

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
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["base"], "base-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "base-map" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "base-map" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Create folder" }));
    const dialog = screen.getByRole("dialog", { name: "Create folder" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Folder name" }),
      "Siblings"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create folder" })
    );

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
    await user.click(screen.getByRole("menuitem", { name: "Upload Image" }));
    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [new File(["move"], "move-map.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "move-map" })).toBeInTheDocument();
    });

    pointerDrag(
      screen.getByRole("button", { name: "move-map" }),
      screen.getByRole("button", { name: "Maps" })
    );

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
