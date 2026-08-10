import { act, fireEvent, screen } from "@testing-library/react";

import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import {
  actor,
  namedActor,
  seedEncounter,
  zone
} from "./CanvasShell.actorSelection.test-support";

describe("CanvasShell actor motion and status", () => {
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

    [
      screen.getByLabelText("dragged"),
      screen.getByLabelText("source-neighbor"),
      screen.getByLabelText("destination-neighbor")
    ].forEach((actorElement) => {
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
      seedEncounter(
        [
          namedActor("actor-1", "Zephyr", "zone-1"),
          namedActor("actor-2", "Aegis", "zone-1")
        ],
        [zone("zone-1", 80, 80, 240, 180)]
      );
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
});
