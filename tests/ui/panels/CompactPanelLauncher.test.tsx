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

  it("closes the panel when a pointer starts outside the drawer", () => {
    const onDrawerChange = vi.fn();
    render(
      <CompactPanelLauncher
        onDrawerChange={onDrawerChange}
        renderPanelContent={(panel) => <p>{panel.title} content</p>}
      />
    );
    const launcher = screen.getByRole("button", { name: "Library panel" });
    fireEvent.pointerDown(launcher, { pointerId: 7, button: 0 });
    fireEvent.pointerUp(launcher, { pointerId: 7 });

    expect(screen.getByRole("dialog", { name: "Library panel" })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", {
      name: "Close panel drawer"
    }), { pointerId: 8, button: 0 });

    expect(screen.queryByRole("dialog", { name: "Library panel" })).not.toBeInTheDocument();
    expect(onDrawerChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the vertical panel menu open after a hold and selects a tapped item", () => {
    vi.useFakeTimers();
    const onPanelChange = vi.fn();
    render(<CompactPanelLauncher onPanelChange={onPanelChange} />);
    const launcher = screen.getByRole("button", { name: "Library panel" });

    fireEvent.pointerDown(launcher, { pointerId: 3, button: 0 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("menu", { name: "Choose panel" })).toBeInTheDocument();

    fireEvent.pointerUp(window, {
      pointerId: 3,
      clientX: 10,
      clientY: 120
    });

    expect(screen.getByRole("menu", { name: "Choose panel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));

    expect(onPanelChange).toHaveBeenCalledWith("properties");
    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Properties panel" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses the panel chooser when tapping outside it", () => {
    vi.useFakeTimers();
    render(<CompactPanelLauncher />);
    const launcher = screen.getByRole("button", { name: "Library panel" });

    fireEvent.pointerDown(launcher, { pointerId: 9, button: 0 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(window, { pointerId: 9 });
    expect(screen.getByRole("menu", { name: "Choose panel" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", {
      name: "Dismiss panel chooser"
    }), { pointerId: 10, button: 0 });

    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
  });

  it("keeps an open panel mounted while choosing a new panel", () => {
    vi.useFakeTimers();
    render(
      <CompactPanelLauncher
        renderPanelContent={(panel) => <p>{panel.title} content</p>}
      />
    );
    const launcher = screen.getByRole("button", { name: "Library panel" });
    fireEvent.pointerDown(launcher, { pointerId: 11, button: 0 });
    fireEvent.pointerUp(launcher, { pointerId: 11 });
    const openPanel = screen.getByRole("dialog", { name: "Library panel" });

    fireEvent.pointerDown(launcher, { pointerId: 12, button: 0 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(window, { pointerId: 12 });

    expect(screen.getByRole("menu", { name: "Choose panel" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Library panel" })).toBe(openPanel);
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));

    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Properties panel" })).toBe(openPanel);
    expect(screen.getByText("Properties content")).toBeInTheDocument();
  });

  it("supports wrapped keyboard navigation and escape", () => {
    render(<CompactPanelLauncher />);
    const launcher = screen.getByRole("button", { name: "Library panel" });
    fireEvent.keyDown(launcher, { key: "ArrowUp" });

    const menu = screen.getByRole("menu", { name: "Choose panel" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Library" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Log" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Choose panel" })).not.toBeInTheDocument();
  });
});
