import { fireEvent, screen, within } from "@testing-library/react";

import { store } from "@store/store";
import { openBackgroundLibrary } from "./AssetLibraryModal.test_support";

describe("AssetLibraryModal URL links", () => {
  it("groups file actions above folder actions and keeps a remote reference", async () => {
    const user = await openBackgroundLibrary();

    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    const menu = screen.getByRole("menu");
    const labels = within(menu).getAllByRole("menuitem").map((item) => item.textContent);

    expect(labels).toEqual([
      "Upload file",
      "Web link",
      "Link asset",
      "Create folder",
      "Upload folder"
    ]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Web link" }));
    await user.type(
      screen.getByRole("textbox", { name: "Image URL" }),
      "https://assets.example/remote-map.png"
    );
    await user.click(screen.getByRole("button", { name: "Add image" }));

    const card = screen.getByRole("button", { name: "remote-map.png" });
    expect(card).toBeInTheDocument();
    expect(
      within(card).getByRole("status", { name: "remote-map.png image loading" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Web link" }));
    await user.type(
      screen.getByRole("textbox", { name: "Image URL" }),
      "https://assets.example/second-map.png"
    );
    await user.click(screen.getByRole("button", { name: "Add image" }));

    const loadingIndicators = screen.getAllByRole("status", {
      name: /image loading/
    });
    expect(loadingIndicators).toHaveLength(2);
    expect(loadingIndicators[0].style.transform).toBe(
      loadingIndicators[1].style.transform
    );

    const image = card.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute(
      "src",
      "https://assets.example/remote-map.png"
    );
    fireEvent.load(image as HTMLImageElement);
    expect(within(card).queryByRole("status")).not.toBeInTheDocument();

    const linkedNode = Object.values(
      store.getState().library.sections.backgrounds.nodesById
    ).find((node) => node.name === "remote-map.png");
    expect(linkedNode?.asset?.dataUrl).toBe(
      "https://assets.example/remote-map.png"
    );
  });
});
