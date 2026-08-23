import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { EntityCollection } from "@core/state/entityCollection";
import type { Actor } from "@entities/actor/types";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(
  id: string,
  name: string,
  initiative: number | undefined,
  currentZoneId = "zoneless"
): Actor {
  return {
    actorType: "creature",
    currentZoneId,
    id,
    initiative,
    layoutGroup: "neutral",
    metadata: {},
    name,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

function seedActors() {
  const seeded = {
    ...createEncounterState({ id: "initiative-ui", name: "Initiative UI" }),
    actors: collection([
      actor("alpha", "Alpha", 15),
      actor("bravo", "Bravo", 10, "visible-zone"),
      actor("charlie", "Charlie", undefined)
    ])
  };
  act(() => {
    store.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("test.seed"),
        nextEncounter: seeded
      })
    );
    store.dispatch(setActiveTool("select"));
    store.dispatch(selectEntity({ entityType: "actor", ids: ["alpha"] }));
  });
}

describe("InitiativePanel", () => {
  it("adds selected, visible, and all actors using their defined scopes", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();

    await user.click(screen.getByTitle("Add selected actors"));
    expect(store.getState().encounter.present.initiativeTracker.actorIds).toEqual([
      "alpha"
    ]);

    await user.click(screen.getByTitle("Add visible actors"));
    expect(store.getState().encounter.present.initiativeTracker.actorIds).toEqual([
      "alpha",
      "bravo"
    ]);

    await user.click(screen.getByTitle("Add all actors"));
    expect(store.getState().encounter.present.initiativeTracker.actorIds).toEqual([
      "alpha",
      "bravo",
      "charlie"
    ]);
    expect(screen.getByTitle("Add all actors")).toBeDisabled();
  });

  it("edits scores and drives start, next, previous, remove, and clear controls", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    const charlieInput = screen.getByRole("spinbutton", {
      name: "Charlie initiative"
    });
    await user.type(charlieInput, "15");
    await user.tab();
    await waitFor(() => {
      expect(store.getState().encounter.present.actors.byId.charlie?.initiative).toBe(15);
    });
    expect(store.getState().encounter.present.initiativeTracker.actorIds).toEqual([
      "alpha",
      "charlie",
      "bravo"
    ]);

    await user.click(screen.getByRole("button", { name: "Start combat" }));
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Current actor").closest("li")).toHaveTextContent("Alpha");
    expect(screen.getByRole("button", { name: "Previous turn" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next turn" }));
    expect(screen.getByLabelText("Current actor").closest("li")).toHaveTextContent("Charlie");
    await user.click(screen.getByRole("button", { name: "Previous turn" }));
    expect(screen.getByLabelText("Current actor").closest("li")).toHaveTextContent("Alpha");

    await user.click(screen.getByRole("button", { name: "End combat" }));
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current actor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start combat" }));

    await user.click(
      screen.getByRole("button", { name: "Remove Alpha from initiative" })
    );
    expect(screen.getByLabelText("Current actor").closest("li")).toHaveTextContent("Charlie");

    await user.click(
      screen.getByRole("button", { name: "Remove all initiative actors" })
    );
    const dialog = screen.getByRole("dialog", {
      name: "Confirm remove all initiative actors"
    });
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(store.getState().encounter.present.initiativeTracker).toEqual({
      actorIds: [],
      currentActorId: null,
      currentRound: null
    });
    expect(screen.getByText("Not Started")).toBeInTheDocument();
  });
});
