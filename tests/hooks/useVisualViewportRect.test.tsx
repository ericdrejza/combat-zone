import { act, renderHook } from "@testing-library/react";

import {
  readVisualViewportRect,
  useVisualViewportRect
} from "@hooks/useVisualViewportRect";

class MockVisualViewport extends EventTarget {
  height = 700;
  offsetLeft = 0;
  offsetTop = 0;
  width = 400;
}

describe("useVisualViewportRect", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "visualViewport"
  );
  let frameCallbacks: FrameRequestCallback[];
  let requestFrame: ReturnType<typeof vi.spyOn>;
  let cancelFrame: ReturnType<typeof vi.spyOn>;
  let viewport: MockVisualViewport;

  beforeEach(() => {
    frameCallbacks = [];
    viewport = new MockVisualViewport();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport
    });
    requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    cancelFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
    if (originalDescriptor) {
      Object.defineProperty(window, "visualViewport", originalDescriptor);
    } else {
      Reflect.deleteProperty(window, "visualViewport");
    }
  });

  function flushAnimationFrames() {
    const pending = frameCallbacks.splice(0);
    pending.forEach((callback) => callback(0));
  }

  it("tracks the visible viewport size and offset after browser events settle", () => {
    const { result } = renderHook(() => useVisualViewportRect());

    expect(result.current).toEqual({
      height: 700,
      offsetLeft: 0,
      offsetTop: 0,
      width: 400
    });

    viewport.height = 390;
    viewport.offsetTop = 180;
    viewport.dispatchEvent(new Event("resize"));
    viewport.height = 380;
    viewport.offsetTop = 190;
    viewport.dispatchEvent(new Event("scroll"));

    expect(result.current.height).toBe(700);
    expect(frameCallbacks).toHaveLength(1);

    act(flushAnimationFrames);

    expect(result.current).toEqual({
      height: 380,
      offsetLeft: 0,
      offsetTop: 190,
      width: 400
    });

    viewport.height = 700;
    viewport.offsetTop = 0;
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
    act(flushAnimationFrames);

    expect(result.current.height).toBe(700);
    expect(result.current.offsetTop).toBe(0);
  });

  it("does not rerender for unchanged measurements and removes listeners", () => {
    let renderCount = 0;
    const { unmount } = renderHook(() => {
      renderCount += 1;
      return useVisualViewportRect();
    });
    const initialRenderCount = renderCount;

    viewport.dispatchEvent(new Event("resize"));
    act(flushAnimationFrames);
    expect(renderCount).toBe(initialRenderCount);

    viewport.dispatchEvent(new Event("resize"));
    expect(frameCallbacks).toHaveLength(1);
    unmount();

    expect(cancelFrame).toHaveBeenCalled();
    requestFrame.mockClear();
    viewport.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("orientationchange"));
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("falls back to layout viewport dimensions when the API is unavailable", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined
    });

    expect(readVisualViewportRect()).toEqual({
      height: document.documentElement.clientHeight || window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
      width: document.documentElement.clientWidth || window.innerWidth
    });
  });
});
