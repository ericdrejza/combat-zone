import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { RENDER_LAYERS } from "@core/rendering/types";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
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
import { collection } from "./CanvasShell.rendering.test-support";

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

  it("renders split section dividers from shared section geometry", () => {
    store.dispatch(resetEncounterState());
    const zone: Zone = {
      colorBorder: "#365314",
      colorFill: "#ffffff",
      id: "zone-dividers",
      layoutOrientation: "LEFT_RIGHT",
      layoutStrategy: "SPLIT_FLEX",
      name: "Divider Zone",
      namePosition: "top-left",
      opacity: 0.7,
      polygon: [
        { x: 40, y: 40 },
        { x: 400, y: 40 },
        { x: 400, y: 220 },
        { x: 40, y: 220 }
      ],
      shape: "rectangle",
      showBorder: true,
      showName: false,
      showSectionDividers: true,
      tags: []
    };
    const actors: Actor[] = (["hero", "neutral", "enemy"] as const).map(
      (layoutGroup) => ({
        actorType: "creature",
        currentZoneId: zone.id,
        id: `actor-${layoutGroup}`,
        layoutGroup,
        metadata: {},
        name: layoutGroup,
        shape: "circle",
        size: "medium",
        statusEffects: []
      })
    );
    actors.push(
      {
        ...actors[0],
        id: "actor-engaged-hero",
        name: "Engaged hero"
      },
      {
        ...actors[2],
        id: "actor-engaged-enemy",
        name: "Engaged enemy"
      }
    );

    store.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("test.seed"),
        nextEncounter: {
          ...createEncounterState({
            id: "encounter-dividers",
            name: "Divider Encounter"
          }),
          actors: collection(actors),
          engagements: collection([{
            id: "divider-engagement",
            layoutOrientation: "LEFT_RIGHT",
            layoutStrategy: "FLEX",
            parentZoneId: zone.id,
            participantIds: ["actor-engaged-hero", "actor-engaged-enemy"]
          }]),
          zones: collection([zone])
        }
      })
    );

    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dividers = container.querySelectorAll(
      "[data-zone-section-divider]"
    );

    expect(dividers).toHaveLength(3);
    for (const divider of dividers) {
      expect(divider).toHaveAttribute("stroke", zone.colorBorder);
      expect(divider).toHaveAttribute("stroke-dasharray", "8 8");
      expect(divider).toHaveAttribute("stroke-opacity", "0.7");
    }
    expect(
      container.querySelector("[data-zone-section-dividers]")
    ).toHaveAttribute("clip-path", "url(#zone-section-clip-zone-dividers)");
  });

});
