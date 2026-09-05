import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { createFolder, uploadImage } from "@library/librarySlice";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function selectTestActor() {
  const encounter = store.getState().encounter.present;
  store.dispatch(commitEncounterChange({
    action: createEncounterActionRecord("actor.create", { actorId: "actor-one" }),
    nextEncounter: createActor(encounter, {
      currentZoneId: "zoneless",
      id: "actor-one",
      image: {
        mediaType: "image/png",
        name: "Direct token",
        source: { kind: "url", url: "https://assets.example/direct.png" }
      },
      name: "Goblin"
    })
  }));
  store.dispatch(setActiveTool("select"));
  store.dispatch(selectEntity({ entityType: "actor", ids: ["actor-one"] }));
}

describe("ActorPropertiesPanel token image source", () => {
  it("reuses compact actor option controls for faction, size, and shape", async () => {
    const user = userEvent.setup();
    renderApp();
    act(selectTestActor);

    expect(screen.getByRole("button", { name: "Set actor faction to Neutral" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Set actor size to Medium" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Set actor shape to Circle" }))
      .toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Set actor faction to Enemy" }));
    await user.click(screen.getByRole("button", { name: "Set actor size to Large" }));
    await user.click(screen.getByRole("button", { name: "Set actor shape to Rectangle" }));

    expect(store.getState().encounter.present.actors.byId["actor-one"])
      .toMatchObject({
        layoutGroup: "enemy",
        shape: "rectangle",
        size: "large"
      });

    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.actors.byId["actor-one"]?.shape)
      .toBe("circle");
  });

  it("edits and selects the direct web URL field", async () => {
    const user = userEvent.setup();
    renderApp();
    act(selectTestActor);

    const input = screen.getByRole("textbox", { name: "Token image URL" });
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveValue("https://assets.example/direct.png");

    await user.click(input);
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe(
      "https://assets.example/direct.png".length
    );

    fireEvent.change(input, { target: { value: "https://assets.example/new.png" } });
    fireEvent.blur(input);
    expect(store.getState().encounter.present.actors.byId["actor-one"]?.image)
      .toEqual({ kind: "url", url: "https://assets.example/new.png" });
  });

  it("sets a Library token with a read-only path and restores both sources with undo/redo", async () => {
    const user = userEvent.setup();
    renderApp();
    let tokenNodeId = "";

    act(() => {
      selectTestActor();
      const folder = createFolder({
        name: "Monsters",
        parentId: "tokens-root",
        sectionId: "tokens"
      });
      const token = uploadImage({
        asset: {
          mediaType: "image/png",
          name: "Goblin token",
          source: { kind: "embedded", dataUrl: "data:image/png;base64,goblin" }
        },
        parentId: folder.payload.id,
        sectionId: "tokens"
      });
      tokenNodeId = token.payload.id;
      store.dispatch(folder);
      store.dispatch(token);
    });

    await user.click(screen.getByRole("button", {
      name: "Choose actor image from library"
    }));
    const dialog = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(dialog).getByRole("tab", { name: "Tokens" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.dblClick(within(dialog).getByRole("button", { name: "Monsters" }));
    await user.click(within(dialog).getByRole("button", { name: "Goblin token" }));
    await user.click(within(dialog).getByRole("button", { name: "Set Actor Image" }));

    const path = screen.getByRole("textbox", { name: "Token Path" });
    expect(path).toHaveValue("Tokens/Monsters/Goblin token");
    expect(path).toHaveAttribute("readonly");
    expect(store.getState().encounter.present.actors.byId["actor-one"]?.metadata)
      .toMatchObject({ sourceLibraryNodeId: tokenNodeId });

    act(() => { store.dispatch(undoEncounterChange()); });
    expect(screen.getByRole("textbox", { name: "Token image URL" })).toHaveValue(
      "https://assets.example/direct.png"
    );

    act(() => { store.dispatch(redoEncounterChange()); });
    expect(screen.getByRole("textbox", { name: "Token Path" })).toHaveValue(
      "Tokens/Monsters/Goblin token"
    );

    await user.click(screen.getByRole("button", {
      name: "Use web link for actor image"
    }));
    const url = screen.getByRole("textbox", { name: "Token image URL" });
    expect(url).toHaveFocus();
    expect(url).toHaveValue("");
    expect(store.getState().encounter.present.actors.byId["actor-one"]?.metadata)
      .not.toHaveProperty("sourceLibraryNodeId", tokenNodeId);
  });
});
