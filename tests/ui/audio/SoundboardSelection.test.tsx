import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createActor, moveActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { getSelectedAudioGroupIds } from "@ui/audio/audioSelection";

function setup() {
  renderApp();
  let encounter = store.getState().encounter.present;
  for (const id of ["one", "two"]) {
    encounter = createZone(encounter, { id, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }] });
    encounter = createAudioCueGroup(encounter, { id: `zone-${id}`, name: `zone-${id}`, section: "zone" });
    encounter = setEntityAudioGroups(encounter, "zone", id, [`zone-${id}`]);
  }
  for (const id of ["fighting", "magic", "shared", "unused"]) encounter = createAudioCueGroup(encounter, { id, name: id, section: "actor" });
  encounter = createAudioCueGroup(encounter, { id: "music", name: "music", section: "music" });
  for (const [id, zone, groups] of [["a", "one", ["fighting", "shared"]], ["b", "two", ["magic", "shared"]], ["c", "zoneless", ["unused"]]] as const) {
    encounter = createActor(encounter, { id, currentZoneId: zone });
    encounter = setEntityAudioGroups(encounter, "actor", id, [...groups]);
  }
  act(() => store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter })));
  act(() => { store.dispatch(setActiveTool("select")); });
  fireEvent.click(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Open Soundboard" }));
  const board = within(screen.getByRole("dialog", { name: "Soundboard modal" }));
  const select = (entityType: "actor" | "zone", ids: string[]) => act(() => { store.dispatch(selectEntity({ entityType, ids })); });
  const names = () => board.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);
  return { board, select, names };
}

describe("Soundboard selection controls", () => {
  it("filters by the union of actor assignments without changing history, and restores all groups without selection", () => {
    const { board, select, names } = setup();
    const before = store.getState().encounter;
    const filter = board.getByRole("button", { name: "Filter to selected entities’ audio groups" });
    const highlight = board.getByRole("button", { name: "Highlight selected entities’ audio groups" });
    expect(filter).toHaveAttribute("aria-pressed", "false");
    expect(highlight).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(highlight);
    select("actor", ["a", "b"]);
    expect(names()).toHaveLength(7);
    expect(getSelectedAudioGroupIds(store.getState().encounter.present, store.getState().interaction.selection)).toEqual(new Set(["fighting", "shared", "magic"]));
    fireEvent.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(highlight).toHaveAttribute("aria-pressed", "true");
    expect(names()).toEqual(["fighting", "magic", "shared"]);
    expect(board.queryByRole("heading", { name: "Encounter" })).not.toBeInTheDocument();
    expect(board.queryByRole("heading", { name: "Zones" })).not.toBeInTheDocument();
    select("actor", []);
    expect(names()).toHaveLength(7);
    select("actor", ["a"]);
    expect(names()).toEqual(["fighting", "shared"]);
    fireEvent.click(filter);
    expect(names()).toHaveLength(7);
    expect(store.getState().encounter).toBe(before);
  });

  it("includes the union of selected Zones and occupants and responds to actor movement", () => {
    const { board, select, names } = setup();
    select("zone", ["one", "two"]);
    fireEvent.click(board.getByRole("button", { name: "Filter to selected entities’ audio groups" }));
    expect(new Set(names())).toEqual(new Set(["zone-one", "zone-two", "fighting", "magic", "shared"]));
    select("zone", ["one"]);
    expect(new Set(names())).toEqual(new Set(["zone-one", "fighting", "shared"]));
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: { id: "move", type: "actor.move", timestamp: 2, payload: {} }, nextEncounter: moveActor(encounter, "c", "one") }));
    });
    expect(new Set(names())).toEqual(new Set(["zone-one", "fighting", "shared", "unused"]));
  });

  it("shows an empty result when a selected entity has no groups", () => {
    const { board, select } = setup();
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: { id: "clear", type: "audio.assignGroup", timestamp: 2, payload: {} }, nextEncounter: setEntityAudioGroups(encounter, "actor", "c", []) }));
    });
    select("actor", ["c"]);
    fireEvent.click(board.getByRole("button", { name: "Filter to selected entities’ audio groups" }));
    expect(board.queryAllByRole("textbox")).toHaveLength(0);
    expect(board.getByRole("status")).toBeVisible();
  });
});
