import { act, screen, waitFor, within } from "@testing-library/react";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { createEngagement } from "@entities/engagement/engagementMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { COMPACT_LAYOUT_QUERY } from "@hooks/useCompactLayout";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function installCompactMatchMedia() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    matches: query === COMPACT_LAYOUT_QUERY,
    media: query,
    onchange: null,
    removeEventListener: vi.fn()
  }));
  return () => {
    window.matchMedia = original;
  };
}

function encounterWithSelectedActions() {
  let encounter = createEncounterState({
    id: "compact-canvas-actions",
    name: "Compact canvas actions"
  });
  encounter = createZone(encounter, {
    id: "zone",
    polygon: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 }
    ],
    shape: "rectangle"
  });
  encounter = createActor(encounter, { currentZoneId: "zone", id: "a" });
  encounter = createActor(encounter, { currentZoneId: "zone", id: "b" });
  encounter = createActor(encounter, { currentZoneId: "zone", id: "c" });
  return createEngagement(encounter, {
    id: "melee",
    parentZoneId: "zone",
    participantIds: ["a", "c"]
  });
}

describe("CanvasShell compact actions", () => {
  it("places Delete before Engage and Disengage in the shared mobile row", async () => {
    const restoreMatchMedia = installCompactMatchMedia();

    try {
      renderApp();
      const encounter = encounterWithSelectedActions();
      act(() => {
        store.dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("test.seed"),
            nextEncounter: encounter
          })
        );
        store.dispatch(setActiveTool("actor"));
        store.dispatch(selectEntity({ entityType: "actor", ids: ["a", "b"] }));
      });

      const canvas = screen.getByRole("main", { name: "Encounter canvas" });
      await waitFor(() => {
        expect(
          within(canvas)
            .getAllByRole("button")
            .map((button) => button.getAttribute("aria-label"))
        ).toEqual([
          "Delete 2 selected actors",
          "Engage selected actors",
          "Disengage selected actors"
        ]);
      });
    } finally {
      restoreMatchMedia();
    }
  });
});
