import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "../../core/encounter/createEncounterState";
import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { EntityCollection } from "../../core/state/entityCollection";
import type { Actor } from "../../entities/actor/types";
import type { Zone } from "../../entities/zone/types";
import { setActiveTool } from "../../interaction/interactionState";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "../../store/encounterSlice";
import { store } from "../../store/store";
import {
  getCanvas,
  mockCanvasBounds,
  renderApp
} from "../../test/ui/renderApp";
import { createRectanglePolygon } from "./zoneGeometry";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(
  id: string,
  name: string,
  layoutGroup: Actor["layoutGroup"] = "hero"
): Actor {
  return {
    actorType: "creature",
    currentZoneId: ZONELESS_ACTOR_ZONE_ID,
    id,
    layoutGroup,
    metadata: {},
    name,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

function zone(): Zone {
  return {
    colorBorder: "#166534",
    colorFill: "#dcfce7",
    id: "zone-target",
    layoutOrientation: "LEFT_RIGHT",
    layoutStrategy: "FLEX",
    name: "Target",
    namePosition: "top-left",
    opacity: 0.45,
    polygon: createRectanglePolygon({ x: 80, y: 80 }, { x: 240, y: 240 }),
    shape: "rectangle",
    showBorder: true,
    showName: true,
    tags: []
  };
}

function seedEncounter(actors: Actor[], zones: Zone[] = []) {
  store.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: {
        ...createEncounterState({
          id: "encounter-zoneless-panel",
          name: "Zoneless Panel"
        }),
        actors: collection(actors),
        zones: collection(zones)
      }
    })
  );
}

function dataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      types.push(type);
    },
    types
  };
}

function dropOnCanvas(
  canvas: HTMLElement,
  transfer: ReturnType<typeof dataTransfer>,
  clientX: number,
  clientY: number
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: transfer }
  });
  canvas.dispatchEvent(event);
}

describe("ZonelessActorPanel", () => {
  it("is collapsed initially, exposes a count, and sorts actors alphabetically", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        actor("actor-z", "Zephyr"),
        actor("actor-a", "Aegis"),
        actor("actor-m", "Mira")
      ]);
      store.dispatch(setActiveTool("actor"));
    });

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    expect(panel).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: "Aegis" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const actorButtons = ["Aegis", "Mira", "Zephyr"].map((name) =>
      screen.getByRole("button", { name })
    );
    expect(
      actorButtons.map((button) => button.lastElementChild?.textContent)
    ).toEqual(["Aegis", "Mira", "Zephyr"]);
  });

  it("groups actors by Hero, Neutral, Enemy while retaining alphabetical order", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        actor("actor-enemy", "Bandit", "enemy"),
        actor("actor-hero", "Aria", "hero"),
        actor("actor-neutral", "Boulder", "neutral")
      ]);
      store.dispatch(setActiveTool("actor"));
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );
    await user.click(screen.getByRole("checkbox", { name: "Group by faction" }));

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    expect(
      within(panel).getAllByRole("heading").map((heading) => heading.textContent)
    ).toEqual(["Hero", "Neutral", "Enemy"]);
  });

  it("moves selected panel actors into a zone and restores them with undo/redo", async () => {
    const user = userEvent.setup();
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis"), actor("actor-b", "Borin")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );
    await user.click(screen.getByRole("button", { name: "Aegis" }));
    fireEvent.click(screen.getByRole("button", { name: "Borin" }), {
      shiftKey: true
    });

    const firstActor = screen.getByRole("button", { name: "Aegis" });
    fireEvent.dragStart(firstActor, { dataTransfer: transfer });
    expect(store.getState().interaction.activeToolId).toBe("actor");
    expect(transfer.types).toContain("application/x-combat-zone-zoneless-actors");
    expect(transfer.getData("application/x-combat-zone-zoneless-actors")).toBe(
      "actor-a,actor-b"
    );

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, { clientX: 120, clientY: 120, dataTransfer: transfer });
    dropOnCanvas(canvas, transfer, 120, 120);

    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      "zone-target"
    );
    expect(store.getState().encounter.present.actors.byId["actor-b"]?.currentZoneId).toBe(
      "zone-target"
    );

    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
    expect(store.getState().encounter.present.actors.byId["actor-b"]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );

    store.dispatch(redoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      "zone-target"
    );
  });

  it("does not create history when a panel actor is dropped outside a zone", async () => {
    const user = userEvent.setup();
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const before = store.getState().encounter;
    const actorButton = screen.getByRole("button", { name: "Aegis" });
    fireEvent.dragStart(actorButton, { dataTransfer: transfer });
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, { clientX: 700, clientY: 500, dataTransfer: transfer });
    dropOnCanvas(canvas, transfer, 700, 500);

    expect(store.getState().encounter.present).toEqual(before.present);
    expect(store.getState().encounter.past).toHaveLength(before.past.length);
  });
});
