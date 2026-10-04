import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { createActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { AudioGroupMembers } from "@ui/audio/AudioGroupMembers";
import { chooseMemberSummary, getAudioGroupMemberSummary, groupMemberNames } from "@ui/audio/audioGroupMembers";

function actors() {
  let state = createAudioCueGroup(createEncounterState({ id: "encounter", name: "Encounter" }), { id: "group", name: "Actors", section: "actor" });
  for (const [index, name] of ["Goblin", "Goblin", "Scout", "Other"].entries()) {
    state = createActor(state, { id: String(index), name, currentZoneId: ZONELESS_ACTOR_ZONE_ID, layoutGroup: index < 3 ? "hero" : "enemy" });
    if (index < 3) state = setEntityAudioGroups(state, "actor", String(index), ["group"]);
  }
  return state;
}

describe("group member summaries", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("counts duplicate names and subtracts the number of represented entities", () => {
    expect(groupMemberNames(["Goblin", "Scout", "Goblin"])).toEqual([{ label: "Goblin x2", count: 2 }, { label: "Scout", count: 1 }]);
    const state = actors();
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.group)).toEqual({
      count: 3, full: "Goblin x2, Scout", condensed: "Goblin x2 and 1 other", countOnly: "3 members", names: ["Goblin x2", "Scout"]
    });
  });

  it("does not replace a complete faction with a faction summary", () => {
    const state = actors();
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.group).full).toBe("Goblin x2, Scout");
  });

  it("uses All only when every actor is assigned", () => {
    let state = actors();
    state = setEntityAudioGroups(state, "actor", "3", ["group"]);
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.group)).toMatchObject({ full: "All", condensed: "All", count: 4, names: ["Goblin x2", "Scout", "Other"] });
  });

  it("uses zone membership independently of actors, including All", () => {
    let state = createAudioCueGroup(actors(), { id: "zones", name: "Zones", section: "zone" });
    for (const id of ["a", "b"]) {
      state = createZone(state, { id, name: id, polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] });
    }
    state = setEntityAudioGroups(state, "zone", "a", ["zones"]);
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.zones).full).toBe("a");
    state = setEntityAudioGroups(state, "zone", "b", ["zones"]);
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.zones).full).toBe("All");
  });

  it("does not call empty or encounter groups All", () => {
    const state = createAudioCueGroup(createEncounterState({ id: "empty", name: "Empty" }), { id: "group", section: "actor" });
    expect(getAudioGroupMemberSummary(state, state.audioCueGroups.byId.group)).toMatchObject({ count: 0, full: "", names: [] });
    const music = createAudioCueGroup(actors(), { id: "music", section: "music" });
    expect(getAudioGroupMemberSummary(music, music.audioCueGroups.byId.music).count).toBe(0);
  });

  it.each([
    [220, 200, 150, "full"], [180, 200, 150, "condensed"], [100, 200, 150, "countOnly"], [0, 200, 150, "full"]
  ] as const)("chooses the appropriate summary for available width %s", (width, full, condensed, expected) => {
    expect(chooseMemberSummary(width, full, condensed)).toBe(expected);
  });

  it("reveals hidden names on hover/focus and recomputes its summary on resize", () => {
    let width = 150;
    let resize: () => void = () => undefined;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 140 } as DOMRect);
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    const state = actors();
    render(<AudioGroupMembers encounter={state} group={state.audioCueGroups.byId.group} />);
    const members = screen.getByLabelText("Members of Actors");
    expect(within(members).getByText("Goblin x2 and 1 other", { selector: "span:not([aria-hidden])" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(members);
    expect(within(screen.getByRole("tooltip")).getByText("Goblin x2")).toBeInTheDocument();
    expect(within(screen.getByRole("tooltip")).getByText("Scout")).toBeInTheDocument();
    fireEvent.mouseLeave(members);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => { width = 80; resize(); });
    expect(within(members).getByText("3 members", { selector: "span:not([aria-hidden])" })).toBeInTheDocument();
    fireEvent.focus(members);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(members);
    act(() => { width = 250; resize(); });
    expect(within(members).getByText("Goblin x2, Scout", { selector: "span:not([aria-hidden])" })).toBeInTheDocument();
    fireEvent.mouseEnter(members);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
