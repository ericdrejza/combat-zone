import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@test/ui/renderApp";

function getTranslate(element: HTMLElement): { x: number; y: number } {
  const match = element.style.transform.match(
    /translateX\(([-\d.]+)px\) translateY\(([-\d.]+)px\)/
  );

  return {
    x: Number(match?.[1] ?? 0),
    y: Number(match?.[2] ?? 0)
  };
}

describe("CanvasShell zone dragging", () => {
  it("gives the zone pointer track priority over actors in Zone mode", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 120, y: 120 }, { x: 220, y: 220 });
    const zone = await screen.findByLabelText("Zone 1");
    const zoneId = zone.getAttribute("data-entity-id") ?? "";

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seedActor"),
          nextEncounter: createActor(encounter, {
            currentZoneId: zoneId,
            id: "actor-in-zone",
            name: "Actor in zone"
          })
        })
      );
      store.dispatch(setActiveTool("zone"));
    });

    const actorElement = await screen.findByLabelText("Actor in zone");
    expect(actorElement.parentElement).toHaveClass("pointer-events-none");

    fireEvent.mouseEnter(actorElement);
    expect(screen.getByText("Zone shape: rectangle")).toBeInTheDocument();

    const beforePoints = zone.getAttribute("points");
    fireEvent.mouseDown(zone, {
      button: 0,
      clientX: 170,
      clientY: 170
    });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 190 });
    fireEvent.mouseUp(canvas);

    expect(zone.getAttribute("points")).not.toEqual(beforePoints);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zoneId]
    });
  });

  it("selects and drags an existing zone in Zone mode instead of drawing over it", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 120, y: 120 }, { x: 220, y: 200 });

    const zone = await screen.findByLabelText("Zone 1");
    const beforePoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(canvas, { clientX: 170, clientY: 150 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
    expect(zone.getAttribute("points")).not.toEqual(beforePoints);
    expect(screen.queryByLabelText("rectangle zone draft")).not.toBeInTheDocument();
  });

  it("commits the visible zone vector and moves its actors by that same vector", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas, {
      left: 300,
      right: 1260,
      x: 300
    });

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 420, y: 120 }, { x: 520, y: 220 });
    const zone = await screen.findByLabelText("Zone 1");
    const zoneId = zone.getAttribute("data-entity-id") ?? "";

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seedActor"),
          nextEncounter: createActor(encounter, {
            currentZoneId: zoneId,
            id: "actor-in-moving-zone",
            name: "Actor in moving zone"
          })
        })
      );
      store.dispatch(setActiveTool("zone"));
    });

    const actorElement = await screen.findByLabelText("Actor in moving zone");
    const actorStart = getTranslate(actorElement);
    const originalPolygon =
      store.getState().encounter.present.zones.byId[zoneId]?.polygon ?? [];

    fireEvent.mouseDown(zone, {
      button: 0,
      clientX: 450,
      clientY: 150
    });
    expect(
      screen.getByRole("main", { name: "Encounter canvas" })
    ).toHaveClass("select-none");
    fireEvent.mouseMove(canvas, { clientX: 490, clientY: 175 });

    const actorDuringDrag = getTranslate(actorElement);
    expect(actorDuringDrag).toEqual({
      x: actorStart.x + 40,
      y: actorStart.y + 25
    });

    fireEvent.mouseUp(canvas);
    expect(
      screen.getByRole("main", { name: "Encounter canvas" })
    ).not.toHaveClass("select-none");

    expect(
      store.getState().encounter.present.zones.byId[zoneId]?.polygon
    ).toEqual(
      originalPolygon.map((point) => ({
        x: point.x + 40,
        y: point.y + 25
      }))
    );
  });

  it("rejects zone moves that would drop vertices off screen", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const originalPoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: -80, clientY: -80 });
    fireEvent.mouseUp(canvas);

    expect(zone).toHaveAttribute("points", originalPoints ?? "");
  });

  it("prevents dropping an existing zone onto another zone", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 80, y: 80 }, { x: 160, y: 160 });
    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 340, y: 160 });

    const zone = await screen.findByLabelText("Zone 2");
    const beforePoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 300, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(canvas);

    expect(zone.getAttribute("points")).toEqual(beforePoints);
  });
});
