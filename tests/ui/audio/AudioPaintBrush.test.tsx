import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function setup(type: "actor" | "zone", groups = ["b", "a"]) {
  renderApp();
  let encounter = store.getState().encounter.present;
  for (const id of ["source", "first", "second"]) {
    encounter = type === "actor" ? createActor(encounter, { id, name: id, currentZoneId: "zoneless" })
      : createZone(encounter, { id, name: id, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }] });
  }
  for (const id of ["a", "b", "c"]) encounter = createAudioCueGroup(encounter, { id, section: type });
  encounter = setEntityAudioGroups(encounter, type, "source", groups);
  encounter = setEntityAudioGroups(encounter, type, "first", ["c"]);
  act(() => {
    store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter }));
    store.dispatch(setActiveTool("audio"));
    store.dispatch(setAudioSectionType(type));
    store.dispatch(selectEntity({ entityType: type, ids: ["source"] }));
  });
  const button = within(screen.getByLabelText("Properties panel")).getByRole("button", { name: "Paint audio groups" });
  const assignments = (id: string) => store.getState().encounter.present[type === "actor" ? "actors" : "zones"].byId[id].audioGroupIds;
  return { button, assignments };
}

describe("audio assignment paintbrush", () => {
  it.each(["actor", "zone"] as const)("replaces ordered %s assignments atomically and preserves undo/redo", async (type) => {
    const { button, assignments } = setup(type);
    const history = store.getState().encounter.past.length;
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Applying audio properties from source/)).toBeVisible();
    expect(store.getState().encounter.past).toHaveLength(history);
    await act(async () => store.dispatch(selectEntity({ entityType: type, ids: ["first", "second"] })));
    expect(assignments("first")).toEqual(["b", "a"]);
    expect(screen.getByText(/Applying audio properties from source/)).toBeVisible();
    expect(assignments("second")).toEqual(["b", "a"]);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    await act(async () => store.dispatch(undoEncounterChange()));
    expect(assignments("first")).toEqual(["c"]);
    expect(assignments("second")).toEqual([]);
    await act(async () => store.dispatch(redoEncounterChange()));
    expect(assignments("first")).toEqual(["b", "a"]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/Applying audio properties from source/)).not.toBeInTheDocument();
    expect(store.getState().interaction.audioPaintBrush).toBeNull();
  });

  it("can paint empty assignments and cancels on right-click or tool changes", async () => {
    const { button, assignments } = setup("actor", []);
    fireEvent.click(button);
    await act(async () => store.dispatch(selectEntity({ entityType: "actor", ids: ["first"] })));
    expect(assignments("first")).toEqual([]);
    fireEvent.contextMenu(window);
    expect(store.getState().interaction.audioPaintBrush).toBeNull();
    const targetButton = within(screen.getByLabelText("Properties panel")).getByRole("button", { name: "Paint audio groups" });
    fireEvent.click(targetButton);
    act(() => store.dispatch(setActiveTool("select")));
    expect(store.getState().interaction.audioPaintBrush).toBeNull();
  });
});
