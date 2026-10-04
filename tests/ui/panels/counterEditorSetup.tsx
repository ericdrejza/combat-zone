import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createActor } from "@entities/actor/actorMutations";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { loadEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { fireEvent, screen } from "@testing-library/react";

export function setup(bounded = false, secondCounter = false, empty = false) {
  resetAppStore();
  const state = createActor(createEncounterState({ id: "counter-editor", name: "Counters" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.counters = { allIds: ["c"], byId: { c: { id: "c", name: "Charges", value: 0, ...(bounded ? { minimum: -2, maximum: 5 } : {}) } } };
  if (secondCounter) {
    state.actors.byId.a.counters.allIds.push("second");
    state.actors.byId.a.counters.byId.second = { id: "second", name: "Energy", value: 3 };
  }
  if (empty) state.actors.byId.a.counters = { allIds: [], byId: {} };
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool("select")); store.dispatch(selectEntity({ entityType: "actor", ids: ["a"] }));
  render(<Provider store={store}><StatusPanel /></Provider>);
  fireEvent.click(screen.getByRole("button", { name: "Edit counters" }));
}
