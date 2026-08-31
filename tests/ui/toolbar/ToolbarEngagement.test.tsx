import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { EngageActionButton } from "@ui/toolbar/EngageActionButton";
import { TouchTooltipProvider } from "@ui/toolbar/TouchTooltip";

describe("Toolbar engagement actions", () => {
  it("disengages only selected engaged actors and preserves undo", async () => {
    const user = userEvent.setup();
    renderApp();
    const actor = (id: string) => ({
      actorType: "creature" as const,
      currentZoneId: "zone",
      id,
      layoutGroup: "neutral" as const,
      metadata: {},
      name: id,
      shape: "circle" as const,
      size: "small" as const,
      statusEffects: []
    });
    const nextEncounter = {
      ...createEncounterState({ id: "disengage", name: "Disengage" }),
      actors: {
        allIds: ["a", "b", "c"],
        byId: { a: actor("a"), b: actor("b"), c: actor("c") }
      },
      engagements: {
        allIds: ["melee"],
        byId: {
          melee: {
            id: "melee",
            layoutOrientation: "LEFT_RIGHT" as const,
            layoutStrategy: "FLEX" as const,
            parentZoneId: "zone",
            participantIds: ["a", "b", "c"]
          }
        }
      },
      zones: {
        allIds: ["zone"],
        byId: {
          zone: {
            colorBorder: "#123456",
            colorFill: "#ffffff",
            id: "zone",
            layoutOrientation: "LEFT_RIGHT" as const,
            layoutStrategy: "FLEX" as const,
            name: "Zone",
            namePosition: "top-left" as const,
            opacity: 1,
            polygon: [
              { x: 0, y: 0 },
              { x: 400, y: 0 },
              { x: 400, y: 400 },
              { x: 0, y: 400 }
            ],
            shape: "rectangle" as const,
            showBorder: true,
            showName: false,
            tags: []
          }
        }
      }
    };

    act(() => {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seed"),
          nextEncounter
        })
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(selectEntity({ entityType: "actor", ids: ["a"] }));
    });

    const button = screen.getByRole("button", {
      name: "Disengage selected actors"
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(
      store.getState().encounter.present.engagements.byId.melee?.participantIds
    ).toEqual(["b", "c"]);
    expect(store.getState().interaction.selection.selectedIds).toEqual(["a"]);

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(
      store.getState().encounter.present.engagements.byId.melee?.participantIds
    ).toEqual(["a", "b", "c"]);
  });

  it("keeps the crossed-swords image out of the native touch drag path", () => {
    vi.useFakeTimers();
    act(() => {
      store.dispatch(setActiveTool("actor"));
      store.dispatch(selectEntity({ entityType: "actor", ids: ["a", "b"] }));
    });

    try {
      render(
        <Provider store={store}>
          <TouchTooltipProvider>
            <EngageActionButton compact />
          </TouchTooltipProvider>
        </Provider>
      );
      const button = screen.getByRole("button", {
        name: "Engage selected actors"
      });
      const icon = button.querySelector("img");

      expect(icon).toHaveAttribute("draggable", "false");
      expect(icon).toHaveClass("pointer-events-none");

      fireEvent.pointerDown(icon ?? button, {
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        pointerType: "touch"
      });
      act(() => vi.advanceTimersByTime(500));

      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Engage selected actors in each zone"
      );
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
    } finally {
      vi.useRealTimers();
    }
  });
});
