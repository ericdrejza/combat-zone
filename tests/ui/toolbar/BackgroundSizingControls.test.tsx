import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { Zone } from "@entities/zone/types";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

const zone: Zone = {
  colorBorder: "#166534",
  colorFill: "#dcfce7",
  id: "zone-1",
  layoutOrientation: "LEFT_RIGHT",
  layoutStrategy: "FLEX",
  name: "Zone",
  namePosition: "top-left",
  opacity: 0.5,
  polygon: [
    { x: 160, y: 160 },
    { x: 320, y: 160 },
    { x: 320, y: 320 },
    { x: 160, y: 320 }
  ],
  shape: "rectangle",
  showBorder: true,
  showName: true,
  tags: []
};

function seedBackgroundEncounter() {
  const encounter = {
    ...createEncounterState({ id: "background-size", name: "Background" }),
    backgroundImage: {
      dataUrl: "data:image/png;base64,map",
      height: 500,
      mediaType: "image/png",
      name: "map.png",
      width: 1000
    },
    zones: { allIds: [zone.id], byId: { [zone.id]: zone } }
  };
  store.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: encounter
    })
  );
}

describe("background sizing controls", () => {
  it("fits, scales zones, and restores the exact snapshot with undo/redo", async () => {
    const user = userEvent.setup();
    renderApp();
    const viewport = screen.getByLabelText("Canvas viewport");
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 400 },
      clientWidth: { configurable: true, value: 600 }
    });
    fireEvent(window, new Event("resize"));
    act(seedBackgroundEncounter);

    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(screen.getByRole("radio", { name: "Fit height" }));

    let encounter = store.getState().encounter.present;
    expect(viewport).toHaveAttribute("data-canvas-zoom", "0.625");
    expect(encounter.canvasSize).toEqual({ height: 640, width: 1280 });
    expect(encounter.zones.byId[zone.id]?.polygon[0]).toEqual({ x: 160, y: 160 });
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe("canvas.resize");
    expect(screen.getByRole("radio", { name: "Fit height" })).toHaveAttribute("aria-checked", "true");

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    encounter = store.getState().encounter.present;
    expect(encounter.canvasSize).toEqual({ height: 640, width: 960 });
    expect(encounter.zones.byId[zone.id]?.polygon).toEqual(zone.polygon);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.canvasSize).toEqual({ height: 640, width: 1280 });
  });

  it("reads the currently visible workspace for a fit command", async () => {
    const user = userEvent.setup();
    renderApp();
    const viewport = screen.getByLabelText("Canvas viewport");
    let height = 400;
    let width = 600;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, get: () => height },
      clientWidth: { configurable: true, get: () => width }
    });
    fireEvent(window, new Event("resize"));
    act(seedBackgroundEncounter);
    await user.click(screen.getByRole("button", { name: "Background" }));

    height = 800;
    width = 1000;
    await user.click(screen.getByRole("radio", { name: "Fit width" }));

    expect(store.getState().encounter.present.canvasSize).toEqual({
      height: 800,
      width: 1600
    });
  });

  it("shrinks and expands by ten percent and retains bounds on delete", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedBackgroundEncounter);
    await user.click(screen.getByRole("button", { name: "Background" }));

    await user.click(screen.getByRole("button", { name: "Shrink" }));
    expect(store.getState().encounter.present.canvasSize).toEqual({
      height: 576,
      width: 864
    });
    await user.click(screen.getByRole("button", { name: "Expand" }));
    expect(store.getState().encounter.present.canvasSize).toEqual({
      height: 634,
      width: 950
    });

    const sizeBeforeDelete = store.getState().encounter.present.canvasSize;
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(store.getState().encounter.present.backgroundImage).toBeNull();
    expect(store.getState().encounter.present.canvasSize).toEqual(sizeBeforeDelete);
  });

  it("offers fit and scale controls for a canvas without an image", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Background" }));
    expect(screen.getByRole("radio", { name: "Fit" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Fit width" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Fit height" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Shrink" }));
    expect(store.getState().encounter.present.backgroundImage).toBeNull();
    expect(store.getState().encounter.present.canvasSize).toEqual({
      height: 576,
      width: 864
    });
  });
});
