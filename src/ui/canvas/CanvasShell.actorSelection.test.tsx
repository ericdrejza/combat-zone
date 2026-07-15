import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { EntityCollection } from "@core/state/entityCollection";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@test/ui/renderApp";
import { createRectanglePolygon } from "./zoneGeometry";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string, currentZoneId = ZONELESS_ACTOR_ZONE_ID): Actor {
  return {
    actorType: "creature",
    currentZoneId,
    id,
    layoutGroup: "hero",
    metadata: {},
    name: id,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

function namedActor(
  id: string,
  name: string,
  currentZoneId = ZONELESS_ACTOR_ZONE_ID
): Actor {
  return {
    ...actor(id, currentZoneId),
    name
  };
}

function zone(id: string, x: number, y: number, width: number, height: number): Zone {
  return {
    colorBorder: "#166534",
    colorFill: "#dcfce7",
    id,
    layoutOrientation: "LEFT_RIGHT",
    layoutStrategy: "FLEX",
    name: id,
    namePosition: "top-left",
    opacity: 0.45,
    polygon: createRectanglePolygon({ x, y }, { x: x + width, y: y + height }),
    shape: "rectangle",
    showBorder: true,
    showName: true,
    tags: []
  };
}

function seedEncounter(
  actors: Actor[],
  zones: Zone[] = [],
  validationMode: "OFF" | "ADVISORY" | "ASSISTED" | "STRICT" = "ADVISORY"
) {
  store.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: {
        ...createEncounterState({
          id: "encounter-actors",
          name: "Actor Selection Encounter"
        }),
        actors: collection(actors),
        validationState: {
          messages: [],
          mode: validationMode
        },
        zones: collection(zones)
      }
    })
  );
}

describe("CanvasShell actor selection", () => {
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
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });

  it("shows hovered and selected actor names in the canvas status badge", async () => {
    renderApp();

    act(() => {
      seedEncounter([
        namedActor("actor-1", "Zephyr", "zone-1"),
        namedActor("actor-2", "Aegis", "zone-1")
      ], [zone("zone-1", 80, 80, 240, 180)]);
      store.dispatch(setActiveTool("actor"));
    });

    const firstActor = await screen.findByLabelText("Zephyr");
    const secondActor = await screen.findByLabelText("Aegis");

    fireEvent.mouseEnter(firstActor);
    expect(screen.getByText("Zephyr")).toBeInTheDocument();

    fireEvent.click(firstActor, { clientX: 100, clientY: 100 });
    fireEvent.click(secondActor, {
      clientX: 140,
      clientY: 100,
      ctrlKey: true
    });

    expect(screen.getByText("Aegis, Zephyr")).toBeInTheDocument();
  });

  it("paints selected actors with active actor tool settings and preserves undo", async () => {
    const user = userEvent.setup();

    renderApp();

    act(() => {
      seedEncounter([
        {
          ...actor("actor-1"),
          layoutGroup: "enemy",
          shape: "rectangle",
          size: "large"
        },
        {
          ...actor("actor-2"),
          layoutGroup: "neutral",
          shape: "rectangle",
          size: "xLarge"
        }
      ]);
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({
          entityType: "actor",
          ids: ["actor-1", "actor-2"]
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    await waitFor(() => {
      const actors = store.getState().encounter.present.actors.byId;

      expect(actors["actor-1"]).toMatchObject({
        layoutGroup: "hero",
        shape: "circle",
        size: "medium"
      });
      expect(actors["actor-2"]).toMatchObject({
        layoutGroup: "hero",
        shape: "circle",
        size: "medium"
      });
    });

    act(() => {
      store.dispatch(undoEncounterChange());
    });

    expect(store.getState().encounter.present.actors.byId["actor-1"]).toMatchObject({
      layoutGroup: "enemy",
      shape: "rectangle",
      size: "large"
    });

    act(() => {
      store.dispatch(redoEncounterChange());
    });

    expect(store.getState().encounter.present.actors.byId["actor-2"]).toMatchObject({
      layoutGroup: "hero",
      shape: "circle",
      size: "medium"
    });

    await user.click(screen.getByRole("button", { name: "Neutral faction" }));
    await user.click(screen.getByRole("button", { name: "Small actor size" }));
    await user.click(screen.getByRole("button", { name: "Rectangle actor shape" }));

    await waitFor(() => {
      const actors = store.getState().encounter.present.actors.byId;

      expect(actors["actor-1"]).toMatchObject({
        layoutGroup: "neutral",
        shape: "rectangle",
        size: "small"
      });
      expect(actors["actor-2"]).toMatchObject({
        layoutGroup: "neutral",
        shape: "rectangle",
        size: "small"
      });
    });
  });

  it("asks before resizing a zone for an assisted actor resize", async () => {
    const user = userEvent.setup();

    renderApp();

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [zone("zone-1", 100, 100, 100, 100)],
        "ASSISTED"
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({
          entityType: "actor",
          ids: ["actor-1"]
        })
      );
    });

    await user.selectOptions(screen.getByRole("combobox", { name: "Size" }), "xLarge");

    expect(screen.getByRole("dialog", { name: "Resize zone approval" })).toBeInTheDocument();
    expect(store.getState().encounter.present.actors.byId["actor-1"]?.size).toBe(
      "medium"
    );

    await user.click(screen.getByRole("button", { name: "Resize" }));

    expect(store.getState().encounter.present.actors.byId["actor-1"]?.size).toBe(
      "xLarge"
    );
    expect(
      store.getState().encounter.present.zones.byId["zone-1"]?.polygon
    ).not.toEqual(zone("zone-1", 100, 100, 100, 100).polygon);
  });
});
