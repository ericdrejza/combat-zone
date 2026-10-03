import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { createActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function setup(assignedIds: string[]) {
  renderApp();
  let encounter = createActor(store.getState().encounter.present, { id: "guard", name: "Guard", currentZoneId: ZONELESS_ACTOR_ZONE_ID });
  for (const id of ["a", "b", "c"]) encounter = createAudioCueGroup(encounter, { id, name: id.toUpperCase(), section: "actor" });
  encounter = setEntityAudioGroups(encounter, "actor", "guard", assignedIds);
  act(() => {
    store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter }));
    store.dispatch(setActiveTool("audio"));
    store.dispatch(setAudioSectionType("actor"));
    store.dispatch(selectEntity({ entityType: "actor", ids: ["guard"], userInitiated: true }));
  });
  return within(screen.getByLabelText("Properties panel"));
}

describe("assigned actor group movement boundaries", () => {
  it("uses assigned order, updates boundaries after moving, and restores them with undo/redo", () => {
    const panel = setup(["b", "a"]);
    const expectBoundaries = (first: string, last: string) => {
      expect(panel.getByRole("button", { name: `Move ${first} up` })).toBeDisabled();
      expect(panel.getByRole("button", { name: `Move ${first} down` })).toBeEnabled();
      expect(panel.getByRole("button", { name: `Move ${last} up` })).toBeEnabled();
      expect(panel.getByRole("button", { name: `Move ${last} down` })).toBeDisabled();
    };
    expectBoundaries("B", "A");
    expect(panel.queryByRole("button", { name: "Move C up" })).not.toBeInTheDocument();
    const historyLength = store.getState().encounter.past.length;
    fireEvent.click(panel.getByRole("button", { name: "Move B up" }));
    fireEvent.click(panel.getByRole("button", { name: "Move A down" }));
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    fireEvent.click(panel.getByRole("button", { name: "Move B down" }));
    expect(store.getState().encounter.present.actors.byId.guard.audioGroupIds).toEqual(["a", "b"]);
    expectBoundaries("A", "B");
    act(() => store.dispatch(undoEncounterChange()));
    expectBoundaries("B", "A");
    act(() => store.dispatch(redoEncounterChange()));
    expectBoundaries("A", "B");
  });

  it("disables both arrows for a single assigned group and updates after assignment changes", () => {
    const panel = setup(["b"]);
    expect(panel.getByRole("button", { name: "Move B up" })).toBeDisabled();
    expect(panel.getByRole("button", { name: "Move B down" })).toBeDisabled();
    fireEvent.click(panel.getByRole("checkbox", { name: "A" }));
    expect(panel.getByRole("button", { name: "Move B down" })).toBeEnabled();
    expect(panel.getByRole("button", { name: "Move A down" })).toBeDisabled();
    fireEvent.click(panel.getByRole("checkbox", { name: "B" }));
    expect(panel.getByRole("button", { name: "Move A up" })).toBeDisabled();
    expect(panel.getByRole("button", { name: "Move A down" })).toBeDisabled();
  });

  it.each(["actor", "zone", "encounter"] as const)("opens the Soundboard from Audio Properties in %s scope", (scope) => {
    const panel = setup(["b"]);
    act(() => store.dispatch(setAudioSectionType(scope)));
    const launcher = panel.getByRole("button", { name: "Open Soundboard" });
    expect(launcher).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(launcher);
    const board = screen.getByRole("dialog", { name: "Soundboard modal" });
    expect(launcher).toHaveAttribute("aria-pressed", "true");
    fireEvent.mouseDown(board);
    expect(launcher).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["actor", "zone"] as const)("reveals the selected %s's group in an already-open Soundboard", (scope) => {
    const panel = setup(["b"]);
    if (scope === "zone") {
      let encounter = createZone(store.getState().encounter.present, { id: "room", name: "Room", polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }] });
      encounter = createAudioCueGroup(encounter, { id: "room-group", name: "Room sounds", section: "zone" });
      encounter = setEntityAudioGroups(encounter, "zone", "room", ["room-group"]);
      act(() => {
        store.dispatch(commitEncounterChange({ action: { id: "zone-setup", type: "test.setup", timestamp: 2, payload: {} }, nextEncounter: encounter }));
        store.dispatch(setAudioSectionType("zone"));
        store.dispatch(selectEntity({ entityType: "zone", ids: ["room"], userInitiated: true }));
      });
    }
    const historyLength = store.getState().encounter.past.length;
    const launcher = panel.getByRole("button", { name: "Open Soundboard" });
    fireEvent.click(launcher);
    const board = within(screen.getByRole("dialog", { name: "Soundboard modal" }));
    const group = scope === "actor" ? "B" : "Room sounds";
    const section = scope === "actor" ? "Actors" : "Zones";
    fireEvent.click(board.getByRole("button", { name: `Collapse ${group}` }));
    fireEvent.click(board.getByRole("button", { name: `Collapse ${section}` }));
    fireEvent.click(launcher);
    expect(board.getByRole("button", { name: `Collapse ${section}` })).toHaveAttribute("aria-expanded", "true");
    expect(board.getByRole("button", { name: `Collapse ${group}` })).toHaveAttribute("aria-expanded", "true");
    expect(board.getByRole("button", { name: `Add cue to ${group}` })).toBeInTheDocument();
    expect(store.getState().encounter.past).toHaveLength(historyLength);
  });
});
