import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { loadEncounterState, commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { renderApp } from "@tests/ui/renderApp";

const DefaultTestImage = globalThis.Image;

describe("Toolbar zone and background", () => {
  afterEach(() => {
    vi.stubGlobal("Image", DefaultTestImage);
    vi.unstubAllGlobals();
  });

  class LoadedImage {
    height = 450;
    naturalHeight = 450;
    naturalWidth = 800;
    width = 800;
    private listeners = new Map<string, () => void>();

    addEventListener(type: string, listener: () => void) {
      this.listeners.set(type, listener);
    }

    set src(_value: string) {
      queueMicrotask(() => this.listeners.get("load")?.());
    }
  }

  it("shows Zone shape radios while active and toggles the active tool to Select", async () => {
    const user = userEvent.setup();

    renderApp();

    const shapeOptions = screen.getByRole("radiogroup", {
      name: "Zone shape options"
    });

    expect(
      within(shapeOptions).getByRole("radio", { name: "Rectangle zone shape" })
    ).toHaveAttribute("aria-checked", "true");
    expect(within(shapeOptions).getByText("1")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("2")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("3")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("4")).toBeInTheDocument();
    expect(
      within(shapeOptions).getByRole("radio", { name: "Hexagon zone shape" })
    ).toBeInTheDocument();

    await user.click(
      within(shapeOptions).getByRole("radio", { name: "Circle zone shape" })
    );

    expect(store.getState().interaction.zoneShapeMode).toBe("circle");
    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zone" }));
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("radiogroup", { name: "Zone shape options" })).not.toBeInTheDocument();
  });

  it("opens the Library for adding and replacing a canvas background image", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(
      screen.getByRole("menuitem", { name: "Add background from library" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Replace" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete" })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("menuitem", { name: "Add background from library" })
    );
    expect(screen.getByRole("dialog", { name: "Asset Library" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("test.seed"),
        nextEncounter: {
          ...encounter,
          backgroundImage: {
            source: { kind: "embedded", dataUrl: "data:image/png;base64,map" },
            height: 100,
            mediaType: "image/png",
            name: "Map",
            width: 100
          }
        }
      }));
    });

    expect(
      screen.getByRole("menuitem", { name: "Replace with library asset" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Add background from library" })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("menuitem", { name: "Replace with library asset" })
    );
    expect(
      screen.getByRole("dialog", { name: "Asset Library" })
    ).toBeInTheDocument();
  });

  it("adds a URL-backed background from the link-2 action", async () => {
    vi.stubGlobal("Image", LoadedImage);
    const user = userEvent.setup();

    renderApp();
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(
      screen.getByRole("menuitem", { name: "Add background from web" })
    );
    await user.type(
      screen.getByRole("textbox", { name: "Image URL" }),
      "https://maps.example/arena.png"
    );
    await user.click(screen.getByRole("button", { name: "Add image" }));

    await waitFor(() => {
      expect(store.getState().encounter.present.backgroundImage).toMatchObject({
        source: { kind: "url", url: "https://maps.example/arena.png" },
        height: 450,
        name: "",
        width: 800
      });
    });
    expect(store.getState().encounter.past).toHaveLength(1);
    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.backgroundImage).toBeNull();
    store.dispatch(redoEncounterChange());
    expect(store.getState().encounter.present.backgroundImage?.source).toEqual({
      kind: "url",
      url: "https://maps.example/arena.png"
    });
  });
  it('applies a web image with vertex snapping after worker failure and restores it through history', async () => {
    vi.stubGlobal('Image', LoadedImage);
    const user = userEvent.setup();
    renderApp();
    const initial = createZone(createEncounterState({ id: 'web-snap', name: 'Web snap' }), {
      id: 'zone', shape: 'polygon', polygon: [
        { x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }
      ]
    });
    initial.movementRules.snapZoneVertices = true;
    act(() => store.dispatch(loadEncounterState(initial)));
    class FailedWorker {
      private onError: (event: object) => void = () => {};
      addEventListener(type: string, listener: (event: object) => void) {
        if (type === 'error') this.onError = listener;
      }
      postMessage() { queueMicrotask(() => this.onError({})); }
      terminate() {}
    }
    vi.stubGlobal('Worker', FailedWorker);
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add background from web' }));
    await user.type(screen.getByRole('textbox', { name: 'Image URL' }), 'https://maps.example/snapped.png');
    await user.click(screen.getByRole('button', { name: 'Add image' }));
    await waitFor(() => expect(store.getState().encounter.present.backgroundImage?.source)
      .toEqual({ kind: 'url', url: 'https://maps.example/snapped.png' }));
    const applied = store.getState().encounter.present;
    expect(applied.canvasSize).toEqual({ width: 960, height: 540 });
    expect(zoneSnappingValid(applied, applied.zones.byId.zone)).toBe(true);
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(initial);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(applied);
  });

});
