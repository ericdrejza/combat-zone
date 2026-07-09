import { act, fireEvent } from "@testing-library/react";

import { createEncounterState } from "../../core/encounter/createEncounterState";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import type { EntityCollection } from "../../core/state/entityCollection";
import type { Actor } from "../../entities/actor/types";
import { setActiveTool } from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import { store } from "../../store/store";
import { renderApp } from "../../test/ui/renderApp";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string): Actor {
  return {
    actorType: "creature",
    currentZoneId: ZONELESS_ACTOR_ZONE_ID,
    id,
    layoutGroup: "hero",
    metadata: {},
    name: id,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

describe("CanvasShell actor selection", () => {
  it("selects all actors with ctrl-a on Actor and Select tools", () => {
    renderApp();

    act(() => {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seed"),
          nextEncounter: {
            ...createEncounterState({
              id: "encounter-actors",
              name: "Actor Selection Encounter"
            }),
            actors: collection([actor("actor-1"), actor("actor-2")])
          }
        })
      );
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
});
