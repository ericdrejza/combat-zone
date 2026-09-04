import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@tests/ui/renderApp";

function createExternalImageTransfer(file?: File) {
  return {
    dropEffect: "none",
    effectAllowed: "copy",
    files: file ? [file] : [],
    items: [],
    types: ["Files"],
    getData: () => ""
  };
}

function dropOnCanvas(
  canvas: HTMLElement,
  dataTransfer: ReturnType<typeof createExternalImageTransfer>,
  clientX = 120,
  clientY = 120
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: dataTransfer }
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}

describe("CanvasShell external image drops", () => {
  it("sets a dropped image as the background and restores it with undo/redo", async () => {
    const user = userEvent.setup();
    const file = new File(["background"], "battle-map.png", {
      type: "image/png"
    });
    const dragOverTransfer = createExternalImageTransfer();
    const transfer = createExternalImageTransfer(file);

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Background" }));

    fireEvent.dragOver(canvas, { dataTransfer: dragOverTransfer });
    expect(dragOverTransfer.dropEffect).toBe("copy");
    dropOnCanvas(canvas, transfer);

    await waitFor(() => {
      expect(screen.getByLabelText("Canvas background image")).toBeInTheDocument();
    });

    const backgroundImage = store.getState().encounter.present.backgroundImage;
    expect(backgroundImage).toMatchObject({
      mediaType: "image/png",
      name: "battle-map.png"
    });
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe(
      "background.add"
    );

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.backgroundImage).toBeNull();

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.backgroundImage).toEqual(
      backgroundImage
    );
  });

  it("creates a configured actor with the dropped image in the target zone", async () => {
    const user = userEvent.setup();
    const file = new File(["token"], "goblin.png", { type: "image/png" });
    const transfer = createExternalImageTransfer(file);

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 80, y: 80 }, { x: 280, y: 280 });
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Enemy faction" }));
    await user.click(screen.getByRole("button", { name: "Large actor size" }));
    await user.click(screen.getByRole("button", { name: "Rectangle actor shape" }));

    dropOnCanvas(canvas, transfer);

    let actorId: string | undefined;
    await waitFor(() => {
      actorId = store.getState().encounter.present.actors.allIds[0];
      expect(actorId).toBeDefined();
    });

    const zoneId = store.getState().encounter.present.zones.allIds[0];
    const actor = store.getState().encounter.present.actors.byId[actorId!];

    expect(actor).toMatchObject({
      currentZoneId: zoneId,
      image: {
        kind: "embedded",
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/)
      },
      layoutGroup: "enemy",
      metadata: {
        sourceAssetMediaType: "image/png",
        sourceAssetName: "goblin.png"
      },
      name: "goblin",
      shape: "rectangle",
      size: "large"
    });
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe(
      "actor.create"
    );

    const actorAfterCreate = actor;
    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId[actorId!]).toBeUndefined();

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId[actorId!]).toEqual(
      actorAfterCreate
    );
  });
});
