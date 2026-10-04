import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { createActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function setup() {
  renderApp();
  act(() => {
    let state = store.getState().encounter.present;
    state = createAudioCueGroup(state, { id: "actors", name: "Actor sounds", section: "actor" });
    state = createAudioCueGroup(state, { id: "zones", name: "Zone sounds", section: "zone" });
    state = createAudioCueGroup(state, { id: "unused", name: "Unused", section: "actor" });
    for (const id of ["a", "b", "c"]) {
      state = createActor(state, { id, name: id === "c" ? "Other" : "Goblin", currentZoneId: ZONELESS_ACTOR_ZONE_ID });
      state = createZone(state, { id: `zone-${id}`, name: `Zone ${id}`, polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] });
      if (id !== "c") {
        state = setEntityAudioGroups(state, "actor", id, ["actors"]);
        state = setEntityAudioGroups(state, "zone", `zone-${id}`, ["zones"]);
      }
    }
    store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: state }));
  });
  return screen.getByLabelText("Audio panel");
}

describe("Audio panel group members", () => {
  it("shows numeric member counts and lists duplicate names on hover and focus", () => {
    const panel = setup();
    const badge = within(panel).getByRole("button", { name: "Select all 2 actor members of Actor sounds" });
    expect(badge).toHaveTextContent(/^2$/);
    expect(within(panel).queryByText(/^Used by/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(badge.parentElement!);
    expect(within(panel).getByRole("tooltip")).toHaveTextContent("Goblin x2");
    fireEvent.mouseLeave(badge.parentElement!);
    expect(within(panel).queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(badge);
    expect(within(panel).getByRole("tooltip")).toHaveTextContent("Goblin x2");
    fireEvent.blur(badge);
    expect(within(panel).queryByRole("tooltip")).not.toBeInTheDocument();
    const zoneBadge = within(panel).getByRole("button", { name: "Select all 2 zone members of Zone sounds" });
    fireEvent.mouseEnter(zoneBadge.parentElement!);
    expect(within(panel).getByRole("tooltip")).toHaveTextContent("Zone a");
    expect(within(panel).getByRole("tooltip")).toHaveTextContent("Zone b");
  });

  it("selects exactly the actor members, replaces prior selection, and does not mutate encounter history", () => {
    const panel = setup();
    act(() => store.dispatch(setActiveTool("zone")));
    const before = store.getState().encounter;
    fireEvent.click(within(panel).getByRole("button", { name: "Select all 2 actor members of Actor sounds" }));
    expect(store.getState().interaction.activeToolId).toBe("select");
    expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: "actor", selectedIds: ["a", "b"] });
    expect(store.getState().encounter).toBe(before);
    act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["b", "c"] })));
    fireEvent.click(within(panel).getByRole("button", { name: "Select all 2 actor members of Actor sounds" }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "b"]);
    expect(store.getState().encounter).toBe(before);
  });

  it.each(["actor", "zone"] as const)("selects member %ss while keeping the Audio tool and changing its section", (type) => {
    const panel = setup();
    act(() => {
      store.dispatch(setActiveTool("audio"));
      store.dispatch(setAudioSectionType("encounter"));
    });
    const before = store.getState().encounter;
    fireEvent.click(within(panel).getByRole("button", { name: `Select all 2 ${type} members of ${type === "actor" ? "Actor sounds" : "Zone sounds"}` }));
    expect(store.getState().interaction.activeToolId).toBe("audio");
    expect(store.getState().interaction.audioTool.sectionType).toBe(type);
    expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: type, selectedIds: type === "actor" ? ["a", "b"] : ["zone-a", "zone-b"] });
    expect(store.getState().encounter).toBe(before);
  });

  it("disables selection for a group without members", () => {
    const panel = setup();
    const badge = within(panel).getByRole("button", { name: "Select all 0 actor members of Unused" });
    expect(badge).toHaveTextContent(/^0$/);
    expect(badge).toBeDisabled();
    const before = store.getState().interaction.selection;
    fireEvent.click(badge);
    expect(store.getState().interaction.selection).toBe(before);
  });
});
