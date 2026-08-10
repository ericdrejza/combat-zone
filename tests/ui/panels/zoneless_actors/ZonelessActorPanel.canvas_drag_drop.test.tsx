import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { setActiveTool } from "@interaction/interactionState";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import {
  getCanvas,
  mockCanvasBounds,
  renderApp
} from "@tests/ui/renderApp";
import { actor, seedEncounter, zone } from "./ZonelessActorPanel.test_support";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ZonelessActorPanel canvas drag and drop", () => {
  it("accepts an actor dragged from a zone into the zoneless panel", () => {
    renderApp();
    act(() => {
      seedEncounter([{
        ...actor("actor-a", "Aegis"),
        currentZoneId: "zone-target"
      }], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    const canvasActor = screen.getByLabelText("Aegis");
    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });

    fireEvent.mouseDown(canvasActor, { button: 0 });
    fireEvent.mouseMove(canvas, { clientX: 420, clientY: 420 });
    fireEvent.mouseUp(panel);

    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe(ZONELESS_ACTOR_ZONE_ID);

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe("zone-target");

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe(ZONELESS_ACTOR_ZONE_ID);
  });

  it("keeps tracking a canvas actor while the cursor crosses the zoneless panel", () => {
    renderApp();
    act(() => {
      seedEncounter([{
        ...actor("actor-a", "Aegis"),
        currentZoneId: "zone-target"
      }], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    const canvasActor = screen.getByLabelText("Aegis");
    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });

    fireEvent.mouseDown(canvasActor, { button: 0, clientX: 120, clientY: 120 });
    fireEvent.mouseMove(panel, { clientX: 420, clientY: 420 });

    const dragOverlay = document.querySelector('[data-drag-overlay="actor"]');

    expect(dragOverlay).toHaveClass("z-30");
    expect(
      dragOverlay?.querySelector('[data-entity-id="actor-a"]')
    ).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Aegis")).toHaveLength(1);
    fireEvent.mouseUp(panel);

    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe(ZONELESS_ACTOR_ZONE_ID);
  });
});
