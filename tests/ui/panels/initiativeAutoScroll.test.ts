import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInitiativeAutoScrollDelta,
  getInitiativeAutoScrollTarget,
  useInitiativeReorderAutoScroll
} from "@ui/panels/initiative/useInitiativeReorderAutoScroll";

afterEach(() => vi.restoreAllMocks());

describe("initiative reorder auto-scroll", () => {
  const bounds = { bottom: 300, top: 100 };

  it("scrolls toward the edge and remains idle through the middle", () => {
    expect(getInitiativeAutoScrollDelta(bounds, 105)).toBeLessThan(0);
    expect(getInitiativeAutoScrollDelta(bounds, 295)).toBeGreaterThan(0);
    expect(getInitiativeAutoScrollDelta(bounds, 200)).toBe(0);
  });

  it("increases speed as the pointer approaches or passes an edge", () => {
    expect(
      Math.abs(getInitiativeAutoScrollDelta(bounds, 100))
    ).toBeGreaterThan(
      Math.abs(getInitiativeAutoScrollDelta(bounds, 130))
    );
    expect(getInitiativeAutoScrollDelta(bounds, 310)).toBe(14);
  });

  it("stops at the start and end of the scrollable list", () => {
    expect(getInitiativeAutoScrollTarget(0, 500, 200, -14)).toBeNull();
    expect(getInitiativeAutoScrollTarget(300, 500, 200, 14)).toBeNull();
    expect(getInitiativeAutoScrollTarget(5, 500, 200, -14)).toBe(0);
    expect(getInitiativeAutoScrollTarget(295, 500, 200, 14)).toBe(300);
  });

  it("does not start scrolling when the list has no overflow", () => {
    expect(getInitiativeAutoScrollTarget(0, 200, 200, -14)).toBeNull();
    expect(getInitiativeAutoScrollTarget(0, 200, 200, 14)).toBeNull();
  });

  it("does not keep scheduling frames while pinned at an edge", () => {
    const frames: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    const { result } = renderHook(() => useInitiativeReorderAutoScroll());
    const list = document.createElement("ol");
    Object.defineProperties(list, {
      clientHeight: { value: 200 },
      scrollHeight: { value: 500 },
      scrollTop: { value: 300, writable: true }
    });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      top: 100
    } as DOMRect);
    const mutableListRef = result.current.listRef as {
      current: HTMLOListElement | null;
    };
    mutableListRef.current = list;

    act(() => result.current.updateAutoScroll(295));
    expect(requestFrame).toHaveBeenCalledTimes(1);
    act(() => frames.shift()?.(0));
    expect(requestFrame).toHaveBeenCalledTimes(1);

    act(() => result.current.updateAutoScroll(295));
    expect(requestFrame).toHaveBeenCalledTimes(1);

    act(() => result.current.updateAutoScroll(105));
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });
});
