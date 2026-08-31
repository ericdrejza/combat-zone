import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EntityCollection } from "@core/state/entityCollection";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { CompactEngagementActionButtons } from "@ui/canvas/CompactEngagementActionButtons";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

const zone = (id: string): Zone => ({
  colorBorder: "#422",
  colorFill: "#fff",
  id,
  layoutOrientation: "LEFT_RIGHT",
  layoutStrategy: "FLEX",
  name: id,
  namePosition: "top-left",
  opacity: 1,
  polygon: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 }
  ],
  shape: "rectangle",
  showBorder: true,
  showName: false,
  tags: []
});

const actor = (id: string, currentZoneId: string): Actor => ({
  actorType: "creature",
  currentZoneId,
  id,
  layoutGroup: "neutral",
  metadata: {},
  name: id,
  shape: "circle",
  size: "small",
  statusEffects: []
});

function renderActions(
  encounter: ReturnType<typeof createEncounterState>,
  activeToolId: "actor" | "select" | "zone",
  selectedIds: string[]
) {
  act(() => {
    store.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("test.seed"),
        nextEncounter: encounter
      })
    );
    store.dispatch(setActiveTool(activeToolId));
    store.dispatch(selectEntity({ entityType: "actor", ids: selectedIds }));
  });

  return render(
    <Provider store={store}>
      <CompactEngagementActionButtons
        activeToolId={activeToolId}
        encounter={encounter}
        selection={{
          overlayTargets: [],
          selectedEntityType: "actor",
          selectedIds
        }}
      />
    </Provider>
  );
}

function baseEncounter() {
  const encounter = createEncounterState({ id: "compact-actions", name: "Compact actions" });
  return {
    ...encounter,
    actors: collection([
      actor("a", "zone-a"),
      actor("b", "zone-a"),
      actor("c", "zone-a"),
      actor("d", "zone-b")
    ]),
    zones: collection([zone("zone-a"), zone("zone-b")])
  };
}

describe("CompactEngagementActionButtons", () => {
  it("hides Engage when selected actors do not share a Zone", () => {
    const encounter = baseEncounter();
    renderActions(encounter, "select", ["a", "d"]);

    expect(screen.queryByRole("button", { name: "Engage selected actors" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disengage selected actors" })).not.toBeInTheDocument();
  });

  it("shows Engage before Disengage when both actions apply", () => {
    const encounter = {
      ...baseEncounter(),
      engagements: collection([
        {
          id: "melee",
          layoutOrientation: "LEFT_RIGHT" as const,
          layoutStrategy: "FLEX" as const,
          parentZoneId: "zone-a",
          participantIds: ["a", "c"]
        }
      ])
    };
    renderActions(encounter, "actor", ["a", "b"]);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Engage selected actors",
      "Disengage selected actors"
    ]);
    for (const button of buttons) {
      expect(button).toHaveClass("h-11", "min-w-11");
    }
  });

  it("stays hidden outside the Actor and Select tools", () => {
    const encounter = baseEncounter();
    renderActions(encounter, "zone", ["a", "b"]);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
