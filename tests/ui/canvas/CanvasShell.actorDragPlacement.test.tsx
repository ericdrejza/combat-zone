import { act, fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import * as validationPipeline from "@core/validation/pipeline";
import {
  actor,
  getMotionPositionHistory,
  getRenderedPoint,
  seedEncounter,
  zone
} from "./CanvasShell.actorSelection.test-support";

describe("CanvasShell actor drag placement", () => {
  it("keeps actor drag speed synchronized through horizontal letterboxing", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas, {
      height: 640,
      right: 1200,
      width: 1200
    });

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [zone("zone-1", 100, 100, 300, 240)]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const actorElement = await screen.findByLabelText("actor-1");
    const actorPoint = getRenderedPoint(actorElement);

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: actorPoint.x + 120,
      clientY: actorPoint.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: actorPoint.x + 160,
      clientY: actorPoint.y + 25
    });

    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(
      document.querySelector(
        '[data-drag-overlay="actor"] [data-entity-id="actor-1"]'
      )
    ).not.toBeInTheDocument();
    expect(getRenderedPoint(actorElement)).toEqual({
      x: actorPoint.x + 40,
      y: actorPoint.y + 25
    });

    fireEvent.mouseUp(canvas);
  });

  it("keeps the existing placement when an actor is dropped in the same zone", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [zone("zone-1", 100, 100, 200, 200)]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const actorElement = await screen.findByLabelText("actor-1");
    const start = getRenderedPoint(actorElement);
    const drop = { x: start.x + 20, y: start.y + 10 };
    const originalPastLength = store.getState().encounter.past.length;
    const validationSpy = vi.spyOn(
      validationPipeline,
      "runValidationPipeline"
    );

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: start.x,
      clientY: start.y
    });
    fireEvent.mouseMove(canvas, { clientX: drop.x, clientY: drop.y });

    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(getRenderedPoint(actorElement)).toEqual(drop);

    fireEvent.mouseUp(canvas);

    expect(screen.getByLabelText("actor-1")).toBe(actorElement);
    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(actorElement).not.toHaveAttribute("data-motion-path");
    expect(getRenderedPoint(actorElement)).toEqual(start);
    expect(getMotionPositionHistory(actorElement).slice(-3)).toEqual([
      start,
      drop,
      start
    ]);
    expect(store.getState().encounter.past).toHaveLength(originalPastLength);
    expect(validationSpy).not.toHaveBeenCalled();
    validationSpy.mockRestore();
  });

  it("keeps one actor at the cursor through a cross-zone drop and settles once", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [
          zone("zone-1", 80, 80, 260, 240),
          zone("zone-2", 440, 80, 300, 240)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const actorElement = await screen.findByLabelText("actor-1");
    const start = getRenderedPoint(actorElement);
    const drop = { x: 600, y: 240 };

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: start.x,
      clientY: start.y
    });
    fireEvent.mouseMove(canvas, { clientX: drop.x, clientY: drop.y });

    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(getRenderedPoint(actorElement)).toEqual(drop);

    fireEvent.mouseUp(canvas);

    const settledActor = screen.getByLabelText("actor-1");
    const settled = getRenderedPoint(settledActor);
    const motionPath = JSON.parse(
      settledActor.getAttribute("data-motion-path") ?? "{}"
    );

    expect(settledActor).toBe(actorElement);
    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(motionPath).toEqual({
      x: [drop.x, settled.x],
      y: [drop.y, settled.y]
    });
    expect(getMotionPositionHistory(settledActor).slice(-2)).toEqual([
      drop,
      settled
    ]);
    expect(
      store.getState().encounter.present.actors.byId["actor-1"]?.currentZoneId
    ).toBe("zone-2");
  });

  it("rebases a same-zone drag after the actor has moved between zones", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [
          zone("zone-1", 80, 80, 260, 240),
          zone("zone-2", 440, 80, 300, 240)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const originalActor = await screen.findByLabelText("actor-1");
    const originalPoint = getRenderedPoint(originalActor);
    const crossZoneDrop = { x: 600, y: 240 };

    fireEvent.mouseDown(originalActor, {
      button: 0,
      clientX: originalPoint.x,
      clientY: originalPoint.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: crossZoneDrop.x,
      clientY: crossZoneDrop.y
    });
    fireEvent.mouseUp(canvas);

    const movedActor = screen.getByLabelText("actor-1");
    const movedPoint = getRenderedPoint(movedActor);
    const sameZoneDrop = { x: movedPoint.x + 20, y: movedPoint.y + 10 };

    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(
      store.getState().encounter.present.actors.byId["actor-1"]?.currentZoneId
    ).toBe("zone-2");

    fireEvent.mouseDown(movedActor, {
      button: 0,
      clientX: movedPoint.x,
      clientY: movedPoint.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: sameZoneDrop.x,
      clientY: sameZoneDrop.y
    });

    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(getRenderedPoint(movedActor)).toEqual(sameZoneDrop);

    fireEvent.mouseUp(canvas);

    expect(screen.getByLabelText("actor-1")).toBe(movedActor);
    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(getRenderedPoint(movedActor)).toEqual(movedPoint);
    expect(getMotionPositionHistory(movedActor).slice(-3)).toEqual([
      movedPoint,
      sameZoneDrop,
      movedPoint
    ]);
    expect(
      store.getState().encounter.present.actors.byId["actor-1"]?.currentZoneId
    ).toBe("zone-2");
  });

  it("drops an existing actor at its visible canvas position when the canvas is offset", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas, {
      left: 300,
      right: 1260,
      x: 300
    });

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [
          zone("zone-1", 100, 100, 200, 200),
          zone("zone-2", 400, 100, 200, 200)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const actorElement = await screen.findByLabelText("actor-1");

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: 465,
      clientY: 200
    });
    fireEvent.mouseMove(canvas, { clientX: 750, clientY: 200 });
    fireEvent.mouseUp(canvas);

    expect(
      store.getState().encounter.present.actors.byId["actor-1"]?.currentZoneId
    ).toBe("zone-2");
  });
});
