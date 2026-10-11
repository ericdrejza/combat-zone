import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COMPACT_LAYOUT_QUERY } from "@hooks/useCompactLayout";
import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("Library panel launcher", () => {
  it.each([["actor", "Tokens"], ["background", "Backgrounds"], ["audio", "Audio"], ["select", "Encounters"]] as const)("opens the %s Library section without encounter changes", (tool, tab) => {
    renderApp();
    act(() => store.dispatch(setActiveTool(tool)));
    const panel = screen.getByRole("region", { name: "Library panel" });
    const controls = within(panel).getByRole("group", { name: "Library panel controls" });
    expect(within(controls).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Open asset library", "Switch Library to list view"]);
    const launcher = within(controls).getByRole("button", { name: "Open asset library" });
    expect(launcher).toHaveAttribute("title", "Open asset library.");
    expect(launcher).toHaveAttribute("aria-haspopup", "dialog");
    const before = store.getState().encounter;
    fireEvent.click(launcher);
    const dialog = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(dialog).getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(store.getState().encounter).toBe(before);
  });
  it("launches the Library from the compact panel header", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query === COMPACT_LAYOUT_QUERY, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    try {
      renderApp();
      act(() => store.dispatch(setActiveTool("audio")));
      fireEvent.click(screen.getByRole("button", { name: "Library panel" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Library panel controls" })).getByRole("button", { name: "Open asset library" }));
      expect(within(screen.getByRole("dialog", { name: "Asset Library" })).getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    } finally { window.matchMedia = originalMatchMedia; }
  });
  it("preserves the Grid/List toggle", () => {
    renderApp();
    const controls = within(screen.getByRole("region", { name: "Library panel" })).getByRole("group", { name: "Library panel controls" });
    fireEvent.click(within(controls).getByRole("button", { name: "Switch Library to list view" }));
    expect(within(controls).getByRole("button", { name: "Switch Library to grid view" })).toHaveAttribute("aria-pressed", "false");
    expect(within(controls).getByRole("button", { name: "Open asset library" })).toBeEnabled();
  });
});
