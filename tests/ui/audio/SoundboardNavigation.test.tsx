import { act, fireEvent, render, screen } from "@testing-library/react";
import { animate } from "motion/react";
import { StrictMode, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { ZONELESS_ACTOR_ZONE_ID, type EncounterState } from "@core/encounter/types";
import { createActor } from "@entities/actor/actorMutations";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import type { SoundboardNavigationRequest } from "@ui/audio/soundboardNavigation";
import { useSoundboardNavigation } from "@ui/audio/useSoundboardNavigation";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  animate: vi.fn((_from: number, to: number, options: { onUpdate: (value: number) => void; onComplete?: () => void }) => {
    options.onUpdate(to);
    options.onComplete?.();
    return { stop: vi.fn() };
  })
}));

function Harness({ encounter, navigation, initiallyCollapsed = true }: { encounter: EncounterState; navigation: SoundboardNavigationRequest; initiallyCollapsed?: boolean }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [collapsedSections, setCollapsedSections] = useState(new Set(initiallyCollapsed ? ["actor"] : []));
  const [collapsedGroups, setCollapsedGroups] = useState(new Set(initiallyCollapsed ? ["a", "b", "c"] : []));
  useSoundboardNavigation({ encounter, navigation, scrollRef, collapsedSections, collapsedGroups, setCollapsedSections, setCollapsedGroups });
  return <div ref={(element) => {
    scrollRef.current = element;
    if (element) {
      Object.defineProperties(element, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 200 } });
      element.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    }
  }} data-testid="scroll">
    <header ref={(element) => { if (element) element.getBoundingClientRect = () => ({ height: 60 } as DOMRect); }} />
    <section data-audio-section-id="actor" ref={(element) => { if (element) element.getBoundingClientRect = () => ({ top: 200 } as DOMRect); }}>
      <button onClick={() => setCollapsedSections(new Set(["actor"]))}>Collapse section</button>
      {!collapsedSections.has("actor") && ["a", "b", "c"].map((id, index) => <div data-audio-group-id={id} key={id} ref={(element) => { if (element) element.getBoundingClientRect = () => ({ top: 300 + index * 100 } as DOMRect); }}>{!collapsedGroups.has(id) && <span>{id} cues</span>}</div>)}
    </section>
  </div>;
}

function encounterWithGroups(assigned: string[]) {
  let encounter = createActor(createEncounterState({ id: "navigation", name: "Navigation" }), { id: "guard", name: "Guard", currentZoneId: ZONELESS_ACTOR_ZONE_ID });
  for (const id of ["a", "b", "c"]) encounter = createAudioCueGroup(encounter, { id, name: id, section: "actor" });
  return setEntityAudioGroups(encounter, "actor", "guard", assigned);
}

describe("Soundboard entity navigation", () => {
  it("restarts interrupted asynchronous scrolling during StrictMode effect replay", () => {
    const callbacks = new Set<() => void>();
    const stop = vi.fn();
    const deferredAnimation = (_from: number, to: number, options: { onUpdate: (value: number) => void; onComplete?: () => void }) => {
      const complete = () => { options.onUpdate(to); options.onComplete?.(); };
      callbacks.add(complete);
      return { stop: () => { callbacks.delete(complete); stop(); } } as ReturnType<typeof animate>;
    };
    vi.mocked(animate).mockImplementationOnce(deferredAnimation as typeof animate).mockImplementationOnce(deferredAnimation as typeof animate);
    render(<StrictMode><Harness initiallyCollapsed={false} encounter={encounterWithGroups(["b"])} navigation={{ entityId: "guard", entityType: "actor", requestId: 1 }} /></StrictMode>);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(1);
    act(() => callbacks.forEach((complete) => complete()));
    expect(screen.getByTestId("scroll").scrollTop).toBe(328);
    fireEvent.click(screen.getByText("Collapse section"));
    expect(screen.queryByText("b cues")).not.toBeInTheDocument();
  });

  it("expands assigned groups and navigates in assigned order without changing the encounter", () => {
    const encounter = encounterWithGroups(["b", "a"]);
    const snapshot = structuredClone(encounter);
    render(<Harness encounter={encounter} navigation={{ entityId: "guard", entityType: "actor", requestId: 1 }} />);
    expect(screen.getByText("b cues")).toBeInTheDocument();
    expect(screen.getByText("a cues")).toBeInTheDocument();
    expect(screen.queryByText("c cues")).not.toBeInTheDocument();
    expect(screen.getByTestId("scroll").scrollTop).toBe(328);
    expect(encounter).toEqual(snapshot);
  });

  it("opens the entity section when there are no assigned groups", () => {
    render(<Harness encounter={encounterWithGroups([])} navigation={{ entityId: "guard", entityType: "actor", requestId: 1 }} />);
    expect(screen.getByTestId("scroll").scrollTop).toBe(128);
    expect(screen.queryByText("a cues")).not.toBeInTheDocument();
  });

  it("handles repeated launches and does not undo subsequent manual collapsing", () => {
    const encounter = encounterWithGroups(["b"]);
    const navigation: SoundboardNavigationRequest = { entityId: "guard", entityType: "actor", requestId: 1 };
    const { rerender } = render(<Harness encounter={encounter} navigation={navigation} />);
    fireEvent.click(screen.getByText("Collapse section"));
    expect(screen.queryByText("b cues")).not.toBeInTheDocument();
    screen.getByTestId("scroll").scrollTop = 0;
    rerender(<Harness encounter={encounter} navigation={{ ...navigation, requestId: 2 }} />);
    expect(screen.getByText("b cues")).toBeInTheDocument();
    expect(screen.getByTestId("scroll").scrollTop).toBe(328);
  });
});
