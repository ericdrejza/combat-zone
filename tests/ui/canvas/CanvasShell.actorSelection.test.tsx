import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
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
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import { createRectanglePolygon } from "@ui/canvas/zones/zoneGeometry";
import * as validationPipeline from "@core/validation/pipeline";

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

function getRenderedPoint(element: HTMLElement): { x: number; y: number } {
  const transform = element.style.transform;
  const match = transform.match(
    /translateX\(([-\d.]+)px\) translateY\(([-\d.]+)px\)/
  );
  if (!match) throw new Error(`Missing rendered point: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe("CanvasShell actor selection", () => {
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
    const originalTransform = actorElement.getAttribute("transform");
    const originalPastLength = store.getState().encounter.past.length;
    const validationSpy = vi.spyOn(
      validationPipeline,
      "runValidationPipeline"
    );

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: 200,
      clientY: 200
    });
    fireEvent.mouseMove(canvas, { clientX: 210, clientY: 210 });
    fireEvent.mouseUp(canvas);

    expect(actorElement.getAttribute("transform")).toBe(originalTransform);
    expect(store.getState().encounter.past).toHaveLength(originalPastLength);
    expect(validationSpy).not.toHaveBeenCalled();
    validationSpy.mockRestore();
  });

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

  it("keeps a dragged actor engaged when it returns inside the visible tether distance", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

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
            engagements: collection([{
              id: "melee",
              layoutOrientation: "LEFT_RIGHT",
              layoutStrategy: "FLEX",
              parentZoneId: "zone-1",
              participantIds: ["a", "b"]
            }])
          }
        })
      );
      store.dispatch(setActiveTool("actor"));
    });

    const actorElement = await screen.findByLabelText("a");
    const point = getRenderedPoint(actorElement);
    const originalPastLength = store.getState().encounter.past.length;

    fireEvent.mouseDown(actorElement, {
      button: 0,
      clientX: point.x,
      clientY: point.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: point.x + 60,
      clientY: point.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: point.x + 20,
      clientY: point.y
    });
    fireEvent.mouseUp(canvas);

    expect(
      store.getState().encounter.present.engagements.byId.melee?.participantIds
    ).toEqual(["a", "b"]);
    expect(store.getState().encounter.past).toHaveLength(originalPastLength);
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
    expect(
      document.querySelector(
        '[data-layer="actors"] [data-entity-id="actor-2"]'
      )
    ).toBe(secondActor);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1", "actor-2"]
    });
  });

  it("keeps a complete engagement intact on a quick cross-zone actor drop", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [
          actor("a", "zone-1"),
          actor("b", "zone-1"),
          actor("c", "zone-1"),
          actor("target", "zone-2")
        ],
        [
          zone("zone-1", 80, 80, 280, 240),
          zone("zone-2", 440, 80, 280, 240)
        ]
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
                  participantIds: ["a", "b", "c"]
                }
              }
            }
          }
        })
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({ entityType: "actor", ids: ["a", "b", "c"] })
      );
    });

    const source = await screen.findByLabelText("a");
    const target = screen.getByLabelText("target");
    const sourcePoint = getRenderedPoint(source);
    const targetPoint = getRenderedPoint(target);
    fireEvent.mouseDown(source, {
      button: 0,
      clientX: sourcePoint.x,
      clientY: sourcePoint.y
    });
    fireEvent.mouseMove(canvas, {
      clientX: targetPoint.x,
      clientY: targetPoint.y
    });
    fireEvent.mouseUp(canvas);

    const present = store.getState().encounter.present;
    expect(present.engagements.byId.melee).toMatchObject({
      parentZoneId: "zone-2",
      participantIds: ["a", "b", "c"]
    });
    expect(
      ["a", "b", "c"].map(
        (actorId) => present.actors.byId[actorId]?.currentZoneId
      )
    ).toEqual(["zone-2", "zone-2", "zone-2"]);
    expect(present.engagements.byId.melee?.participantIds).not.toContain(
      "target"
    );

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(
      store.getState().encounter.present.engagements.byId.melee?.parentZoneId
    ).toBe("zone-1");
  });

  it("joins an existing engagement only after the 500ms hover intent", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [
          actor("source", "zone-1"),
          actor("b", "zone-2"),
          actor("c", "zone-2")
        ],
        [
          zone("zone-1", 80, 80, 280, 240),
          zone("zone-2", 440, 80, 280, 240)
        ]
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
                  parentZoneId: "zone-2",
                  participantIds: ["b", "c"]
                }
              }
            }
          }
        })
      );
      store.dispatch(setActiveTool("actor"));
    });

    const source = await screen.findByLabelText("source");
    const target = screen.getByLabelText("b");
    const sourcePoint = getRenderedPoint(source);
    const targetPoint = getRenderedPoint(target);
    vi.useFakeTimers();
    try {
      fireEvent.mouseDown(source, {
        button: 0,
        clientX: sourcePoint.x,
        clientY: sourcePoint.y
      });
      fireEvent.mouseMove(canvas, {
        clientX: targetPoint.x,
        clientY: targetPoint.y
      });
      expect(
        screen.queryByLabelText("Engagement drop intent")
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Engage selected actors" })
      ).toHaveAttribute("aria-pressed", "false");

      act(() => {
        vi.advanceTimersByTime(500);
      });
      const intent = screen.getByLabelText("Engagement drop intent");
      expect(intent).toBeInTheDocument();
      expect(within(intent).getByLabelText("Crossed swords")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Engage selected actors" })
      ).toHaveAttribute("aria-pressed", "true");
      fireEvent.mouseUp(canvas);
    } finally {
      vi.useRealTimers();
    }

    expect(
      store.getState().encounter.present.engagements.byId.melee?.participantIds
    ).toEqual(["b", "c", "source"]);
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

  it("animates every affected actor when moving an actor between zones", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    act(() => {
      seedEncounter(
        [
          actor("dragged", "zone-1"),
          actor("source-neighbor", "zone-1"),
          actor("destination-neighbor", "zone-2")
        ],
        [
          zone("zone-1", 80, 80, 260, 240),
          zone("zone-2", 420, 80, 260, 240)
        ]
      );
      store.dispatch(setActiveTool("actor"));
    });

    const dragged = await screen.findByLabelText("dragged");
    const sourceNeighbor = screen.getByLabelText("source-neighbor");
    const destinationNeighbor = screen.getByLabelText("destination-neighbor");

    fireEvent.mouseDown(dragged, {
      button: 0,
      clientX: 165,
      clientY: 200
    });
    fireEvent.mouseMove(canvas, { clientX: 520, clientY: 200 });
    fireEvent.mouseUp(canvas);

    expect(
      store.getState().encounter.present.actors.byId.dragged?.currentZoneId
    ).toBe("zone-2");
    expect(screen.getByLabelText("source-neighbor")).toBe(sourceNeighbor);
    expect(screen.getByLabelText("destination-neighbor")).toBe(
      destinationNeighbor
    );

    [dragged, sourceNeighbor, destinationNeighbor].forEach((actorElement) => {
      const path = JSON.parse(
        actorElement.getAttribute("data-motion-path") ?? "{}"
      ) as { x?: number[]; y?: number[] };

      expect(path.x?.length).toBe(2);
      expect(path.y?.length).toBe(2);
      expect(
        path.x?.[0] !== path.x?.[1] || path.y?.[0] !== path.y?.[1]
      ).toBe(true);
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
