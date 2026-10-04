import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterPanelOrder } from "@core/encounter/panelLayout";
import encounterReducer, { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { persistenceWriteGuardMiddleware, setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { ApplyPanelOrderButton } from "@ui/settings/ApplyPanelOrderButton";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

const order: EncounterPanelOrder = {
  left: ["audio", "status"],
  right: ["log", "properties", "library", "initiative"]
};

function setup(readOnly = false, mode: "STRICT" | "ADVISORY" = "ADVISORY") {
  const store = configureStore({
    reducer: { encounter: encounterReducer },
    middleware: (getDefault) => getDefault().concat(persistenceWriteGuardMiddleware)
  });
  const encounter = createEncounterState({ id: "test", name: "Test" });
  encounter.panelLayout.left[0].collapsed = true;
  encounter.panelLayout.right[2].collapsed = true;
  encounter.validationState.mode = mode;
  store.dispatch(loadEncounterState(encounter));
  render(<Provider store={store}>
    <PersistenceContext.Consumer>{(context) =>
      <PersistenceContext.Provider value={{ ...context, readOnly }}>
        <ApplyPanelOrderButton order={order} />
      </PersistenceContext.Provider>
    }</PersistenceContext.Consumer>
  </Provider>);
  return store;
}

describe("ApplyPanelOrderButton", () => {
  afterEach(() => setPersistenceWritable(true));

  it.each(["ADVISORY", "STRICT"] as const)("applies order with undo/redo in %s and preserves collapsed panels", (mode) => {
    const store = setup(false, mode);
    const before = store.getState().encounter.present;
    fireEvent.click(screen.getByRole("button", { name: "Apply to current encounter" }));
    const after = store.getState().encounter.present;
    expect(after.panelLayout.left.map((panel) => panel.id)).toEqual(order.left);
    expect(after.panelLayout.right.map((panel) => panel.id)).toEqual(order.right);
    expect([...after.panelLayout.left, ...after.panelLayout.right].filter((panel) => panel.collapsed).map((panel) => panel.id))
      .toEqual(["audio", "library"]);
    expect(after.validationState).toEqual(before.validationState);
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present).toEqual(before);
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present).toEqual(after);
    fireEvent.click(screen.getByRole("button", { name: "Apply to current encounter" }));
    expect(store.getState().encounter.past).toHaveLength(1);
  });

  it("disables applying order in a read-only tab", () => {
    const store = setup(true);
    const before = store.getState();
    const button = screen.getByRole("button", { name: "Apply to current encounter" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(store.getState()).toEqual(before);
  });

  it("blocks mutation at the writer boundary even when the button is enabled", () => {
    const store = setup();
    const before = store.getState();
    setPersistenceWritable(false);
    fireEvent.click(screen.getByRole("button", { name: "Apply to current encounter" }));
    expect(store.getState()).toEqual(before);
  });
});
