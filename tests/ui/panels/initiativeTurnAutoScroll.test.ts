import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  getInitiativeTurnScrollTarget,
  useInitiativeTurnAutoScroll
} from "@ui/panels/initiative/useInitiativeTurnAutoScroll";

describe("initiative turn auto-scroll", () => {
  it("keeps the current position when the active and on-deck rows are visible", () => {
    expect(
      getInitiativeTurnScrollTarget({
        active: { bottom: 160, top: 120 },
        currentScrollTop: 100,
        maximumScrollTop: 400,
        onDeck: { bottom: 208, top: 168 },
        viewportHeight: 120
      })
    ).toBe(100);
  });

  it("scrolls enough to reveal both active and on-deck rows when possible", () => {
    expect(
      getInitiativeTurnScrollTarget({
        active: { bottom: 280, top: 240 },
        currentScrollTop: 100,
        maximumScrollTop: 400,
        onDeck: { bottom: 328, top: 288 },
        viewportHeight: 120
      })
    ).toBe(212);
  });

  it("prioritizes the active row when both rows cannot fit", () => {
    expect(
      getInitiativeTurnScrollTarget({
        active: { bottom: 280, top: 240 },
        currentScrollTop: 100,
        maximumScrollTop: 400,
        onDeck: { bottom: 420, top: 288 },
        viewportHeight: 120
      })
    ).toBe(236);
  });

  it("reveals the active row when there is no on-deck participant", () => {
    expect(
      getInitiativeTurnScrollTarget({
        active: { bottom: 500, top: 460 },
        currentScrollTop: 100,
        maximumScrollTop: 400,
        viewportHeight: 120
      })
    ).toBe(384);
  });

  it("leaves the full active row inside the viewport when scrolling backward", () => {
    const target = getInitiativeTurnScrollTarget({
      active: { bottom: 140.4, top: 100.4 },
      currentScrollTop: 150,
      maximumScrollTop: 400,
      onDeck: { bottom: 188.4, top: 148.4 },
      viewportHeight: 120
    });

    expect(target).toBeCloseTo(96.4);
    expect(100.4 - target).toBeGreaterThanOrEqual(4);
  });

  it("moves the list when turn navigation changes the active participant", () => {
    const list = document.createElement("ol");
    const activeRow = document.createElement("li");
    activeRow.dataset.initiativeActorId = "bravo";
    const onDeckRow = document.createElement("li");
    onDeckRow.dataset.initiativeActorId = "charlie";
    list.append(activeRow, onDeckRow);
    Object.defineProperties(list, {
      clientHeight: { value: 120 },
      scrollHeight: { value: 500 },
      scrollTop: { value: 0, writable: true }
    });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
      bottom: 220,
      top: 100
    } as DOMRect);
    vi.spyOn(activeRow, "getBoundingClientRect").mockReturnValue({
      bottom: 380,
      top: 340
    } as DOMRect);
    vi.spyOn(onDeckRow, "getBoundingClientRect").mockReturnValue({
      bottom: 428,
      top: 388
    } as DOMRect);
    const listRef = { current: list } as RefObject<HTMLOListElement>;
    const { rerender } = renderHook(
      ({ currentActorId }: { currentActorId: string | null }) =>
        useInitiativeTurnAutoScroll(
          listRef,
          ["alpha", "bravo", "charlie"],
          currentActorId,
          true
        ),
      { initialProps: { currentActorId: null as string | null } }
    );

    rerender({ currentActorId: "bravo" });

    expect(list.scrollTop).toBe(212);
  });
});
