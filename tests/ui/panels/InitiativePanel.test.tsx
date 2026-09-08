import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  getInitiativeActorIds,
  getInitiativeEntry
} from "@core/encounter/initiativeMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { EntityCollection } from "@core/state/entityCollection";
import type { Actor } from "@entities/actor/types";
import {
  clearSelection,
  selectEntity,
  setActiveTool
} from "@interaction/interactionState";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

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
  currentZoneId = "zoneless"
): Actor {
  return {
    actorType: "creature",
    currentZoneId,
    id,
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
      actor("alpha", "Alpha"),
      actor("bravo", "Bravo", "visible-zone"),
      actor("charlie", "Charlie")
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

function displayedInitiativeActorIds(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-initiative-actor-id]")
  ).map((row) => row.dataset.initiativeActorId!);
}

describe("InitiativePanel", () => {
  it("adds selected, visible, and all actors using their defined scopes", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();

    await user.click(screen.getByTitle("Add selected actors"));
    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
      "alpha"
    ]);

    await user.click(screen.getByTitle("Add visible actors"));
    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
      "alpha",
      "bravo"
    ]);

    await user.click(screen.getByTitle("Add all actors"));
    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
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

    await user.type(
      screen.getByRole("textbox", { name: "Alpha initiative" }),
      "15"
    );
    await user.tab();
    await user.type(
      screen.getByRole("textbox", { name: "Bravo initiative" }),
      "10"
    );
    await user.tab();

    const charlieInput = screen.getByRole("textbox", {
      name: "Charlie initiative"
    });
    await user.type(charlieInput, "15");
    await user.tab();
    await waitFor(() => {
      expect(
        getInitiativeEntry(store.getState().encounter.present, "charlie")?.value
      ).toBe(15);
    });
    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
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
      entries: [],
      currentActorId: null,
      currentRound: 1
    });
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next round" }));
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous round" }));
    expect(screen.getByText("Round 1")).toBeInTheDocument();

    await user.click(screen.getByTitle("Add all actors"));
    expect(
      store.getState().encounter.present.initiativeTracker.currentActorId
    ).toBe("alpha");
    expect(
      store.getState().encounter.present.initiativeTracker.entries
    ).toEqual([
      { actorId: "alpha" },
      { actorId: "bravo" },
      { actorId: "charlie" }
    ]);
  });

  it("auto-selects the active actor after turn navigation only while enabled", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));
    await user.click(screen.getByRole("button", { name: "Start combat" }));

    act(() => {
      store.dispatch(setActiveTool("zone"));
    });
    const autoSelect = screen.getByRole("button", {
      name: "Auto-select active actor"
    });
    expect(autoSelect).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Next turn" }));
    expect(store.getState().interaction.activeToolId).toBe("select");
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["bravo"]
    });

    await user.click(screen.getByRole("button", { name: "Previous turn" }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(["alpha"]);

    await user.click(autoSelect);
    expect(autoSelect).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next turn" }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(["alpha"]);
  });

  it("keeps the persisted startup default separate from the session toggle", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    const sessionToggle = screen.getByRole("button", {
      name: "Auto-select active actor"
    });
    expect(sessionToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    await user.click(screen.getByRole("tab", { name: "Interface" }));
    const startupDefault = screen.getByRole("switch", {
      name: "Auto-select active actor in initiative"
    });
    await user.click(startupDefault);

    expect(startupDefault).not.toBeChecked();
    expect(sessionToggle).toHaveAttribute("aria-pressed", "true");
    await user.click(sessionToggle);
    expect(sessionToggle).toHaveAttribute("aria-pressed", "false");
    expect(startupDefault).not.toBeChecked();
    await user.click(sessionToggle);
    expect(sessionToggle).toHaveAttribute("aria-pressed", "true");
    expect(startupDefault).not.toBeChecked();

    unmount();
    renderApp();
    expect(
      screen.getByRole("button", { name: "Auto-select active actor" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("adjusts an entered initiative value with left and right chevrons", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    const alphaInput = screen.getByRole("textbox", {
      name: "Alpha initiative"
    });
    expect(alphaInput).toHaveAttribute("type", "text");
    await user.type(alphaInput, "15");
    await user.tab();
    const historyLength = store.getState().encounter.past.length;
    const loggedValueChanges = () =>
      store
        .getState()
        .encounterLog.entries.filter(
          ({ actionType }) => actionType === "initiative.updateValue"
        );
    const initialLogCount = loggedValueChanges().length;
    const alphaRow = alphaInput.closest("li")!;
    await user.hover(alphaRow);
    const increase = screen.getByRole("button", {
      name: "Increase Alpha initiative"
    });

    await user.click(increase);
    await user.click(increase);
    await user.click(increase);

    expect(alphaInput).toHaveValue("18");
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBe(15);
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    expect(loggedValueChanges()).toHaveLength(initialLogCount);

    await user.unhover(alphaRow);
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBe(18);
    expect(store.getState().encounter.past).toHaveLength(historyLength + 1);
    expect(loggedValueChanges()).toHaveLength(initialLogCount + 1);
    expect(loggedValueChanges().at(-1)?.message).toContain(
      "Set Alpha's initiative to 18."
    );

    act(() => store.dispatch(undoEncounterChange()));
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBe(15);
    act(() => store.dispatch(redoEncounterChange()));
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBe(18);
  });

  it("adjusts a blank initiative value from zero with either chevron", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    const alphaRow = screen
      .getByRole("textbox", { name: "Alpha initiative" })
      .closest("li")!;
    await user.hover(alphaRow);
    await user.click(
      screen.getByRole("button", { name: "Decrease Alpha initiative" })
    );
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBeUndefined();
    await user.unhover(alphaRow);
    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBe(-1);

    const bravoRow = screen.getByText("Bravo").closest("li")!;
    await user.hover(bravoRow);
    await user.click(
      screen.getByRole("button", { name: "Increase Bravo initiative" })
    );
    expect(
      getInitiativeEntry(store.getState().encounter.present, "bravo")?.value
    ).toBeUndefined();
    await user.unhover(bravoRow);
    expect(
      getInitiativeEntry(store.getState().encounter.present, "bravo")?.value
    ).toBe(1);
  });

  it("defers chevron sorting until the edited row is no longer hovered", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    const charlieRow = screen.getByText("Charlie").closest("li")!;
    await user.hover(charlieRow);
    await user.click(
      screen.getByRole("button", { name: "Increase Charlie initiative" })
    );

    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
      "alpha",
      "bravo",
      "charlie"
    ]);
    expect(displayedInitiativeActorIds()).toEqual([
      "alpha",
      "bravo",
      "charlie"
    ]);

    await user.unhover(charlieRow);
    await waitFor(() => {
      expect(displayedInitiativeActorIds()).toEqual([
        "charlie",
        "alpha",
        "bravo"
      ]);
    });
  });

  it("sorts immediately when a manual initiative edit is submitted", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    const bravoRow = screen.getByText("Bravo").closest("li")!;
    await user.hover(bravoRow);
    await user.type(
      screen.getByRole("textbox", { name: "Bravo initiative" }),
      "20{Enter}"
    );

    await waitFor(() => {
      expect(displayedInitiativeActorIds()).toEqual([
        "bravo",
        "alpha",
        "charlie"
      ]);
    });
  });

  it("logs an invalid manual value without changing state or history", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));
    const historyLength = store.getState().encounter.past.length;

    await user.type(
      screen.getByRole("textbox", { name: "Alpha initiative" }),
      "100{Enter}"
    );

    expect(
      getInitiativeEntry(store.getState().encounter.present, "alpha")?.value
    ).toBeUndefined();
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    expect(store.getState().encounterLog.entries.at(-1)).toMatchObject({
      actionType: "initiative.updateValue",
      category: "validation",
      kind: "validation-block"
    });
    expect(store.getState().encounterLog.entries.at(-1)?.message).toContain(
      "Set Alpha's initiative to 100."
    );
  });

  it("selects on click and makes current without selecting on double-click", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    act(() => {
      store.dispatch(setActiveTool("zone"));
    });
    await user.click(screen.getByText("Bravo").closest("li")!);
    await waitFor(() => {
      expect(store.getState().interaction.selection).toMatchObject({
        selectedEntityType: "actor",
        selectedIds: ["bravo"]
      });
    });
    expect(store.getState().interaction.activeToolId).toBe("select");

    await user.click(screen.getByRole("button", { name: "Start combat" }));
    await user.dblClick(screen.getByText("Charlie").closest("li")!);
    await waitFor(() => {
      expect(
        store.getState().encounter.present.initiativeTracker.currentActorId
      ).toBe("charlie");
    });
    expect(store.getState().interaction.selection.selectedIds).toEqual(["bravo"]);
    expect(store.getState().encounter.present.initiativeTracker.currentRound).toBe(1);

    await user.click(screen.getByRole("button", { name: "End combat" }));
    const historyLength = store.getState().encounter.past.length;
    await user.dblClick(screen.getByText("Alpha").closest("li")!);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(store.getState().encounter.present.initiativeTracker.currentActorId).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    expect(store.getState().interaction.selection.selectedIds).toEqual(["bravo"]);
  });

  it("toggles with Ctrl and cumulatively selects an anchored range with Shift", async () => {
    const user = userEvent.setup();
    renderApp();
    seedActors();
    await user.click(screen.getByTitle("Add all actors"));

    fireEvent.click(screen.getByText("Charlie").closest("li")!, {
      ctrlKey: true
    });
    await waitFor(() => {
      expect(store.getState().interaction.selection.selectedIds).toEqual([
        "alpha",
        "charlie"
      ]);
    });

    const bravoRow = screen.getByText("Bravo").closest("li")!;
    expect(fireEvent.mouseDown(bravoRow, { shiftKey: true })).toBe(false);
    fireEvent.click(bravoRow, {
      shiftKey: true
    });
    await waitFor(() => {
      expect(store.getState().interaction.selection.selectedIds).toEqual([
        "alpha",
        "charlie",
        "bravo"
      ]);
    });

    fireEvent.click(screen.getByText("Alpha").closest("li")!, {
      ctrlKey: true
    });
    await waitFor(() => {
      expect(store.getState().interaction.selection.selectedIds).toEqual([
        "charlie",
        "bravo"
      ]);
    });

    act(() => {
      store.dispatch(clearSelection());
    });
    fireEvent.click(screen.getByText("Bravo").closest("li")!, {
      shiftKey: true
    });
    await waitFor(() => {
      expect(store.getState().interaction.selection.selectedIds).toEqual([
        "bravo"
      ]);
    });
    await user.click(
      screen.getByRole("button", {
        name: "Remove selected initiative actors"
      })
    );
    expect(getInitiativeActorIds(store.getState().encounter.present)).toEqual([
      "alpha",
      "charlie"
    ]);
  });
});
