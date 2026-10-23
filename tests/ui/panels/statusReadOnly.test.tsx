import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { loadEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { resetAppStore } from "@tests/ui/renderApp";

it("disables every Status mutation in a read-only tab", () => {
  resetAppStore();
  const state = createActor(createEncounterState({ id: "readonly", name: "Read only" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.hitPoints = { current: 10, maximum: 20 };
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool("select")); store.dispatch(selectEntity({ entityType: "actor", ids: ["a"] }));
  render(<Provider store={store}><PersistenceContext.Consumer>{(context) => <PersistenceContext.Provider value={{ ...context, readOnly: true }}><StatusPanel /></PersistenceContext.Provider>}</PersistenceContext.Consumer></Provider>);
  const disclosure = screen.getByRole("button", { name: "Conditions" });
  expect(disclosure).toBeEnabled();
  for (const button of screen.getAllByRole("button")) {
    if (button !== disclosure) expect(button).toBeDisabled();
  }
  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Apply damage" }));
  const before = store.getState().encounter.present;
  fireEvent.click(disclosure); expect(disclosure).toHaveAttribute("aria-expanded", "false");
  expect(store.getState().encounter.present).toBe(before);
  expect(store.getState().encounter.past).toHaveLength(0);
});
