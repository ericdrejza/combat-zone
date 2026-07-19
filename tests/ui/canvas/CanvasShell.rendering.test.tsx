import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { RENDER_LAYERS } from "@core/rendering/types";
import type { EntityCollection } from "@core/state/entityCollection";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import {
  commitEncounterChange,
  resetEncounterState
} from "@store/encounterSlice";
import { store } from "@store/store";
import {
  createCircleZone,
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool,
  startPolygonMode
} from "@tests/ui/renderApp";
import { App } from "@ui/App";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

describe("CanvasShell rendering", () => {
  it("renders canvas layers in documented order without placeholder overlays", () => {
    const { container } = renderApp();
    const layerIds = Array.from(container.querySelectorAll("[data-layer]")).map(
      (layer) => layer.getAttribute("data-layer")
    );

    expect(layerIds).toEqual(RENDER_LAYERS.map((layer) => layer.id));
    expect(
      screen.queryByLabelText("Selection overlay placeholder")
    ).not.toBeInTheDocument();
  });

  it("uses background luminance for circle zone name text even with opaque fill", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createCircleZone(canvas);

    await screen.findByLabelText("Zone 1");
    await user.click(screen.getByRole("button", { name: "Fill color #991b1b" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "1" }
    });
    await user.click(screen.getByRole("button", { name: "Show zone name" }));

    await waitFor(() => {
      const zoneNameText = Array.from(canvas.querySelectorAll("text")).find(
        (element) => element.textContent === "Zone 1"
      );

      expect(zoneNameText).toHaveAttribute("fill", "#111827");
    });
  });

  it("does not render foreignObject zone contents for any zone shape", async () => {
    const user = userEvent.setup();

    const { container } = renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 120, y: 120 });
    createCircleZone(canvas, { x: 180, y: 40 }, { x: 260, y: 120 });
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 320, clientY: 40 });
    fireEvent.click(canvas, { clientX: 440, clientY: 40 });
    fireEvent.doubleClick(canvas, { clientX: 440, clientY: 160 });

    expect(await screen.findByLabelText("Zone 3")).toBeInTheDocument();
    expect(container.querySelector("foreignObject")).toBeNull();
  });

  it("outlines all actors by faction color while Alt is held in Actor or Select tool", () => {
    store.dispatch(resetEncounterState());
    const zone: Zone = {
      colorBorder: "#9b876b",
      colorFill: "#ffffff",
      id: "zone-alt",
      layoutOrientation: "LEFT_RIGHT",
      layoutStrategy: "FLEX",
      name: "Alt Zone",
      namePosition: "top-left",
      opacity: 0.7,
      polygon: [
        { x: 40, y: 40 },
        { x: 280, y: 40 },
        { x: 280, y: 200 },
        { x: 40, y: 200 }
      ],
      shape: "rectangle",
      showBorder: true,
      showName: false,
      tags: []
    };
    const actors: Actor[] = [
      {
        actorType: "creature",
        currentZoneId: zone.id,
        id: "actor-hero",
        image: "data:image/png;base64,hero",
        layoutGroup: "hero",
        metadata: {},
        name: "Hero",
        shape: "circle",
        size: "medium",
        statusEffects: []
      },
      {
        actorType: "creature",
        currentZoneId: zone.id,
        id: "actor-neutral",
        layoutGroup: "neutral",
        metadata: {},
        name: "Neutral",
        shape: "rectangle",
        size: "medium",
        statusEffects: []
      },
      {
        actorType: "creature",
        currentZoneId: zone.id,
        id: "actor-enemy",
        layoutGroup: "enemy",
        metadata: {},
        name: "Enemy",
        shape: "circle",
        size: "medium",
        statusEffects: []
      }
    ];

    store.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("test.seed"),
        nextEncounter: {
          ...createEncounterState({
            id: "encounter-alt",
            name: "Alt Encounter"
          }),
          actors: collection(actors),
          zones: collection([zone])
        }
      })
    );
    store.dispatch(setActiveTool("actor"));
    store.dispatch(
      selectEntity({
        entityType: "actor",
        ids: ["actor-hero"]
      })
    );

    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    fireEvent.keyDown(window, { key: "Alt" });

    expect(
      container.querySelector(
        `[stroke="${ACTOR_LAYOUT_GROUP_COLORS.hero.outline}"]`
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        `[stroke="${ACTOR_LAYOUT_GROUP_COLORS.neutral.outline}"]`
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        `[stroke="${ACTOR_LAYOUT_GROUP_COLORS.enemy.outline}"]`
      )
    ).toBeInTheDocument();

    fireEvent.keyUp(window, { key: "Alt" });

    expect(
      container.querySelector(
        `[stroke="${ACTOR_LAYOUT_GROUP_COLORS.hero.outline}"]`
      )
    ).toBeNull();

    const selectedActorName = Array.from(container.querySelectorAll("text")).find(
      (text) =>
        text.textContent === "HERO" && text.getAttribute("dy") !== null
    );
    expect(selectedActorName).toHaveAttribute("fill", "#111827");
  });
});
