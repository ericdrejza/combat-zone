import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { uploadImage } from "@library/librarySlice";
import { store } from "@store/store";
import { openBackgroundLibrary } from "./AssetLibraryModal.test_support";

function addLibraryImage(
  sectionId: "backgrounds" | "tokens",
  name: string,
  data: string
) {
  const action = uploadImage({
    asset: {
      height: 100,
      mediaType: "image/png",
      name: `${name}.png`,
      source: { dataUrl: `data:image/png;base64,${data}`, kind: "embedded" },
      width: 100
    },
    parentId: `${sectionId}-root`,
    sectionId
  });

  act(() => {
    store.dispatch(action);
  });

  return action.payload.id;
}

describe("AssetLibraryModal footer actions", () => {
  it("opens actor creation with the selected token image", async () => {
    const user = await openBackgroundLibrary();
    const tokenId = addLibraryImage("tokens", "Goblin", "goblin");

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    await user.click(screen.getByRole("button", { name: "Goblin.png" }));
    await user.click(screen.getByRole("button", { name: "Create Actor" }));

    const dialog = await screen.findByRole("dialog", { name: "Create actor" });
    expect(dialog).toBeInTheDocument();
    const actorImage = within(dialog).getByRole("img", {
      name: "Actor image"
    });
    expect(actorImage).toHaveAttribute("src", "data:image/png;base64,goblin");
    expect(actorImage).toHaveAttribute("draggable", "false");
    const actorName = within(dialog).getByRole("textbox", { name: "Actor name" });
    expect(actorName).toHaveValue("Goblin.png");
    await user.clear(actorName);
    const actorPreview = within(dialog).getByLabelText("Actor preview");
    fireEvent.pointerDown(actorPreview, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    expect(screen.getByRole("status", { name: "Dragging Actor" })).toBeInTheDocument();
    fireEvent.pointerUp(window, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    expect(store.getState().library.sections.tokens.nodesById[tokenId]).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
  });

  it("sets the selected background on the active encounter", async () => {
    const user = await openBackgroundLibrary();
    const backgroundId = addLibraryImage("backgrounds", "Battle map", "battle-map");

    await user.click(screen.getByRole("button", { name: "Battle map.png" }));
    await user.click(screen.getByRole("button", { name: "Set Background" }));

    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present.backgroundImage).toMatchObject({
      libraryNodeId: backgroundId,
      source: { dataUrl: "data:image/png;base64,battle-map", kind: "embedded" }
    });
  });
});
