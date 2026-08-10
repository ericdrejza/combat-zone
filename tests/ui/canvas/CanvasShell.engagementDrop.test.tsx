import { act, fireEvent, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import {
  commitEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import {
  actor,
  getRenderedPoint,
  seedEncounter,
  zone
} from "./CanvasShell.actorSelection.test-support";

describe("CanvasShell engagement drop", () => {
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
        [actor("source", "zone-1"), actor("b", "zone-2"), actor("c", "zone-2")],
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
});
