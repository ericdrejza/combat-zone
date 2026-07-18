import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "@tests/ui/renderApp";

async function openBackgroundLibrary() {
  const user = userEvent.setup();

  renderApp();

  await user.click(screen.getByRole("button", { name: "Library" }));
  await user.click(screen.getByRole("tab", { name: "Backgrounds" }));

  return user;
}

async function createFolder(name: string) {
  vi.spyOn(window, "prompt").mockReturnValueOnce(name);

  await userEvent.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Create new folder" }));
}

function createDragDataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    data,
    dropEffect: "",
    effectAllowed: "",
    files: [],
    items: [],
    types,
    getData(type: string) {
      return data.get(type) ?? "";
    },
    setData(type: string, value: string) {
      data.set(type, value);

      if (!types.includes(type)) {
        types.push(type);
      }
    }
  };
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
