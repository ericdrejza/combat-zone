import { act, render } from "@testing-library/react";

import { ControlledVideo } from "@core/rendering/ControlledVideo";

describe("ControlledVideo", () => {
  it("pauses offscreen playback and releases its source on unmount", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);

    let reportIntersection: IntersectionObserverCallback = () => undefined;
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback;
      }
      disconnect() {}
      observe() {}
      takeRecords() { return []; }
      unobserve() {}
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);

    const { container, unmount } = render(
      <ControlledVideo play src="https://example.com/token.webm" />
    );
    const video = container.querySelector("video") as HTMLVideoElement;

    act(() => {
      reportIntersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(play).toHaveBeenCalled();

    act(() => {
      reportIntersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(pause).toHaveBeenCalled();
    expect(video).toHaveAttribute("preload", "metadata");

    unmount();
    expect(video).not.toHaveAttribute("src");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
