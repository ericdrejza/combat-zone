import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { addActorsToInitiative, startInitiative } from "@core/encounter/initiativeMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { updateActorStatus } from "@entities/actor/actorStatus";
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { InitiativePanel } from "@ui/panels/InitiativePanel";

function seed(started = false) {
  resetAppStore();
  let state = createEncounterState({ id: "health-ui", name: "Health UI" });
  for (const id of ["Alpha", "Bravo"]) state = createActor(state, { id, name: id, currentZoneId: "zoneless" });
  state = addActorsToInitiative(state, state.actors.allIds);
  if (started) state = startInitiative(state);
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.seed"), nextEncounter: state }));
  render(<Provider store={store}><InitiativePanel /></Provider>);
}

describe("initiative status controls", () => {
  it("offers row-wide options in order and commits health with exact undo/redo", () => {
    seed();
    fireEvent.click(screen.getByRole("button", { name: "Alpha status: Healthy" }));
    const choices = within(screen.getByRole("group", { name: "Alpha status options" })).getAllByRole("button");
    expect(choices.map((button) => button.title)).toEqual(["Remove from initiative", "Dead", "Unconscious / severely injured", "Injured", "Healthy"]);
    const before = store.getState().encounter.present;
    fireEvent.click(choices[1]);
    expect(screen.getByRole("button", { name: "Alpha status: Dead" })).toBeInTheDocument();
    const dead = store.getState().encounter.present;
    expect(dead.actors.byId.Alpha.status).toBe(0);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present).toEqual(before);
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present).toEqual(dead);
    fireEvent.click(screen.getByRole("button", { name: "Alpha status: Dead" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha from initiative" }));
    expect(store.getState().encounter.present.actors.byId.Alpha.status).toBe(0);
    expect(store.getState().encounter.present.initiativeTracker.entries).toEqual([{ actorId: "Bravo" }]);
  });

  it.each([false, true])("disables combat controls with an explanation when all are dead (started=%s)", (started) => {
    seed(started);
    act(() => {
      let state = store.getState().encounter.present;
      for (const id of state.actors.allIds) state = updateActorStatus(state, id, 0);
      store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.dead"), nextEncounter: state }));
    });
    for (const name of started ? ["Previous turn", "Next turn"] : ["Start combat"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button.title).toMatch(/All initiative participants are dead/);
    }
    if (started) expect(store.getState().encounter.present.initiativeTracker.currentActorId).toBe("Alpha");
  });
});
