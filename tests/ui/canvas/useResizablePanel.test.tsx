import { act, fireEvent, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";

import { DEFAULT_PANEL_SIZE, useResizablePanel } from "@ui/canvas/useResizablePanel";

function resizeEvent(width = DEFAULT_PANEL_SIZE.width) {
  const panel = document.createElement("aside");
  const handle = document.createElement("button");
  panel.append(handle);
  panel.getBoundingClientRect = () => ({ width, height: 240 }) as DOMRect;
  return {
    clientX: 400,
    clientY: 400,
    currentTarget: handle,
    preventDefault() {}
  } as MouseEvent<HTMLButtonElement>;
}

describe("centered panel resizing", () => {
  it.each(["left", "right"] as const)("keeps the %s edge moving at cursor speed", edge => {
    const { result } = renderHook(useResizablePanel);
    const direction = edge === "right" ? 1 : -1;
    act(() => result.current.startResize(resizeEvent(), edge));
    fireEvent.mouseMove(window, { clientX: 400 + direction * 40, clientY: 400 });

    // A centered panel's dragged edge travels half the total width change.
    expect((result.current.size.width - DEFAULT_PANEL_SIZE.width) / 2).toBe(40);
    expect(result.current.size.height).toBe(240);

    fireEvent.mouseMove(window, { clientX: 400 - direction * 20, clientY: 400 });
    expect((result.current.size.width - DEFAULT_PANEL_SIZE.width) / 2).toBe(-20);
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 600, clientY: 400 });
    expect(result.current.isResizing).toBe(false);
    expect(result.current.size.width).toBe(DEFAULT_PANEL_SIZE.width - 40);
  });

  it("starts at the rendered width when the viewport constrains the panel", () => {
    const { result } = renderHook(useResizablePanel);
    act(() => result.current.startResize(resizeEvent(450), "right"));
    fireEvent.mouseMove(window, { clientX: 380, clientY: 400 });
    expect(result.current.size.width).toBe(410);
  });

  it("resizes vertically at cursor speed and resets both dimensions", () => {
    const { result } = renderHook(useResizablePanel);
    act(() => result.current.startResize(resizeEvent(), "top"));
    fireEvent.mouseMove(window, { clientX: 400, clientY: 350 });
    expect(result.current.size).toEqual({ width: DEFAULT_PANEL_SIZE.width, height: 290 });
    expect(result.current.isResized).toBe(true);
    act(() => result.current.resetSize());
    expect(result.current.size).toEqual(DEFAULT_PANEL_SIZE);
    expect(result.current.isResized).toBe(false);
    expect(result.current.isResizing).toBe(false);
  });
});
