import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import {
  TouchTooltip,
  TouchTooltipProvider
} from "@ui/toolbar/TouchTooltip";

describe("TouchTooltipProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows any titled element after a touch hold without activating it", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <TouchTooltipProvider>
        <button onClick={onClick} title="Helpful action" type="button">
          Action
        </button>
      </TouchTooltipProvider>
    );
    const button = screen.getByRole("button", { name: "Action" });

    fireEvent.pointerDown(button, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch"
    });
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful action");
    fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not enter the touch tooltip path for a held mouse pointer", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <TouchTooltipProvider>
        <button onClick={onClick} title="Mouse help" type="button">
          Mouse action
        </button>
      </TouchTooltipProvider>
    );
    const button = screen.getByRole("button", { name: "Mouse action" });

    fireEvent.pointerDown(button, {
      button: 0,
      pointerId: 2,
      pointerType: "mouse"
    });
    act(() => vi.advanceTimersByTime(600));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("blocks touch-generated context menus across the application", () => {
    const onContextMenu = vi.fn();
    render(
      <TouchTooltipProvider>
        <div onContextMenu={onContextMenu}>Canvas-like surface</div>
      </TouchTooltipProvider>
    );
    const surface = screen.getByText("Canvas-like surface");

    fireEvent.pointerDown(surface, {
      button: 0,
      pointerId: 4,
      pointerType: "touch"
    });
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true
    });
    surface.dispatchEvent(contextMenu);

    expect(contextMenu.defaultPrevented).toBe(true);
    expect(onContextMenu).not.toHaveBeenCalled();
  });

  it("preserves genuine mouse context menus", () => {
    const onContextMenu = vi.fn();
    render(
      <TouchTooltipProvider>
        <div onContextMenu={onContextMenu}>Mouse surface</div>
      </TouchTooltipProvider>
    );
    const surface = screen.getByText("Mouse surface");
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true
    });

    surface.dispatchEvent(contextMenu);

    expect(contextMenu.defaultPrevented).toBe(false);
    expect(onContextMenu).toHaveBeenCalledOnce();
  });

  it("uses explicit tooltip labels when an element has no title", () => {
    vi.useFakeTimers();
    render(
      <TouchTooltipProvider>
        <TouchTooltip label="Explicit help">
          <button type="button">Wrapped action</button>
        </TouchTooltip>
      </TouchTooltipProvider>
    );
    const button = screen.getByRole("button", { name: "Wrapped action" });

    fireEvent.pointerDown(button, {
      button: 0,
      pointerId: 3,
      pointerType: "touch"
    });
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Explicit help");
  });
});
