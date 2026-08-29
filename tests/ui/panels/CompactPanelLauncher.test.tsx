import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { CompactPanelLauncher } from "@ui/panels/CompactPanelLauncher";

describe("CompactPanelLauncher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens and closes the selected panel on a short tap", () => {
    const onDrawerChange = vi.fn();
    render(
      <CompactPanelLauncher
        onDrawerChange={onDrawerChange}
        renderPanelContent={(panel) => <p>{panel.title} content</p>}
      />
    );

    const launcher = screen.getByRole("button", { name: "Library panel" });
    fireEvent.pointerDown(launcher, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(launcher, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(screen.getByRole("dialog", { name: "Library panel" })).toBeInTheDocument();
    expect(screen.getByText("Library content")).toBeInTheDocument();
    expect(onDrawerChange).toHaveBeenCalledWith(true);

    fireEvent.pointerDown(launcher, { pointerId: 2, button: 0 });
    fireEvent.pointerUp(launcher, { pointerId: 2, clientX: 10, clientY: 10 });
    expect(screen.queryByRole("dialog", { name: "Library panel" })).not.toBeInTheDocument();
    expect(onDrawerChange).toHaveBeenLastCalledWith(false);
  });

  it("opens the vertical panel menu after a hold and selects a dragged item", () => {
    vi.useFakeTimers();
    const onPanelChange = vi.fn();
    render(<CompactPanelLauncher onPanelChange={onPanelChange} />);
    const launcher = screen.getByRole("button", { name: "Library panel" });

    fireEvent.pointerDown(launcher, { pointerId: 3, button: 0 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("menu", { name: "Choose panel" })).toBeInTheDocument();

    const properties = screen.getByRole("menuitem", { name: "Properties" });
    properties.getBoundingClientRect = () => ({
      bottom: 150,
      height: 50,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON() {}
    });
    fireEvent.pointerEnter(properties, { pointerId: 3 });
    fireEvent.pointerMove(window, {
      pointerId: 3,
      clientX: 10,
      clientY: 120
    });
    fireEvent.pointerUp(window, {
      pointerId: 3,
      clientX: 10,
      clientY: 120
    });

    expect(onPanelChange).toHaveBeenCalledWith("properties");
    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
  });

  it("supports wrapped keyboard navigation and escape", () => {
    render(<CompactPanelLauncher />);
    const launcher = screen.getByRole("button", { name: "Library panel" });
    fireEvent.keyDown(launcher, { key: "ArrowUp" });

    const menu = screen.getByRole("menu", { name: "Choose panel" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Library" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Zoneless" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
  });
});
