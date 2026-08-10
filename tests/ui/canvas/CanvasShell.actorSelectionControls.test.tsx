import { act, fireEvent, screen } from "@testing-library/react";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import {
  actor,
  seedEncounter,
  zone
} from "./CanvasShell.actorSelection.test-support";

describe("CanvasShell actor selection controls", () => {
  it("selects all actors with ctrl-a on Actor and Select tools", () => {
    renderApp();

    act(() => {
      seedEncounter([actor("actor-1"), actor("actor-2")]);
      store.dispatch(setActiveTool("actor"));
    });

    fireEvent.keyDown(window, { ctrlKey: true, key: "a" });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });

    act(() => {
      store.dispatch(setActiveTool("select"));
    });

    fireEvent.keyDown(window, { ctrlKey: true, key: "a" });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });

  it("selects every participant when an engagement token is clicked", async () => {
    renderApp();

    act(() => {
      seedEncounter(
        [actor("a", "zone-1"), actor("b", "zone-1")],
        [zone("zone-1", 80, 80, 280, 240)]
      );
      const seeded = store.getState().encounter.present;
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.engagement"),
          nextEncounter: {
            ...seeded,
            engagements: {
              allIds: ["melee"],
              byId: {
                melee: {
                  id: "melee",
                  layoutOrientation: "LEFT_RIGHT",
                  layoutStrategy: "FLEX",
                  parentZoneId: "zone-1",
                  participantIds: ["a", "b"]
                }
              }
            }
          }
        })
      );
      store.dispatch(setActiveTool("actor"));
    });

    fireEvent.click(await screen.findByLabelText("Crossed swords"));

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["a", "b"]
    });
  });

  it("cumulatively box selects actors with shift-drag on the Actor tool", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1"), actor("actor-2", "zone-1")],
        [zone("zone-1", 100, 100, 200, 200)]
      );
      store.dispatch(setActiveTool("actor"));
    });

    await screen.findByLabelText("actor-1");

    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: 210,
      clientY: 170,
      shiftKey: true
    });
    fireEvent.mouseMove(canvas, { clientX: 290, clientY: 230 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1"]
    });

    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: 110,
      clientY: 170,
      shiftKey: true
    });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 230 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });

  it("selects all actors in a zone by double-clicking the zone", async () => {
    renderApp();

    act(() => {
      seedEncounter(
        [
          actor("actor-1", "zone-1"),
          actor("actor-2", "zone-1"),
          actor("actor-3", "zone-2")
        ],
        [
          zone("zone-1", 100, 100, 200, 200),
          zone("zone-2", 400, 100, 200, 200)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const zoneElement = await screen.findByLabelText("zone-1");
    fireEvent.doubleClick(zoneElement, { clientX: 140, clientY: 140 });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });

  it("moves all selected actors when dragging one selected actor", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1"), actor("actor-2", "zone-1")],
        [
          zone("zone-1", 100, 100, 200, 200),
          zone("zone-2", 400, 100, 200, 200)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const firstActor = await screen.findByLabelText("actor-1");
    const secondActor = await screen.findByLabelText("actor-2");

    fireEvent.click(firstActor, { clientX: 165, clientY: 200 });
    fireEvent.click(secondActor, {
      clientX: 235,
      clientY: 200,
      ctrlKey: true
    });
    fireEvent.mouseDown(firstActor, { button: 0, clientX: 165, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const actors = store.getState().encounter.present.actors.byId;

    expect(actors["actor-1"]?.currentZoneId).toBe("zone-2");
    expect(actors["actor-2"]?.currentZoneId).toBe("zone-2");
    expect(screen.getAllByLabelText("actor-1")).toHaveLength(1);
    expect(screen.getAllByLabelText("actor-2")).toHaveLength(1);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });
});
