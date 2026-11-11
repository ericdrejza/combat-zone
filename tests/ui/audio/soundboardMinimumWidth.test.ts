import { afterEach, describe, expect, it, vi } from "vitest";

import { attachSoundboardMinimumWidth } from "@ui/audio/soundboardMinimumWidth";

function setup() {
  vi.useFakeTimers();
  const popup = Object.assign(new EventTarget(), {
    innerWidth: 320, outerWidth: 340, outerHeight: 700, closed: false, resizeTo: vi.fn()
  });
  const cleanup = attachSoundboardMinimumWidth(popup as unknown as Window);
  return { popup, cleanup, resize: () => popup.dispatchEvent(new Event("resize")) };
}

describe("Soundboard minimum window width", () => {
  afterEach(() => vi.useRealTimers());

  it("waits until resizing pauses and preserves browser chrome and height", () => {
    const { popup, resize, cleanup } = setup();
    resize();
    vi.advanceTimersByTime(300);
    popup.innerWidth = 300;
    popup.outerWidth = 320;
    resize();
    vi.advanceTimersByTime(300);
    expect(popup.resizeTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(popup.resizeTo).toHaveBeenCalledExactlyOnceWith(390, 700);
    cleanup();
  });

  it("does not loop when the browser ignores a correction or resize an adequate window", () => {
    const { popup, resize, cleanup } = setup();
    resize();
    vi.advanceTimersByTime(500);
    resize();
    vi.advanceTimersByTime(1000);
    expect(popup.resizeTo).toHaveBeenCalledOnce();
    popup.innerWidth = 400;
    resize();
    vi.advanceTimersByTime(500);
    expect(popup.resizeTo).toHaveBeenCalledOnce();
    cleanup();
  });

  it("cancels pending corrections and removes the listener on cleanup", () => {
    const { popup, resize, cleanup } = setup();
    resize();
    cleanup();
    vi.advanceTimersByTime(1000);
    resize();
    vi.advanceTimersByTime(1000);
    expect(popup.resizeTo).not.toHaveBeenCalled();
  });
});
