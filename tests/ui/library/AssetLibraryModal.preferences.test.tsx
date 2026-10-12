import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

function open(preferences: object = {}) {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  renderApp();
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  return screen.getByRole("dialog", { name: "Asset Library" });
}

describe("Library modal preference behavior", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it.each([false, true])("permits outside-click dismissal only when enabled=%s", (enabled) => {
    const library = open({ libraryCloseOnOutsideClick: enabled });
    const history = store.getState().encounter;
    fireEvent.mouseDown(within(library).getByRole("heading", { name: "Asset Library" }));
    expect(library).toBeInTheDocument();
    fireEvent.mouseDown(library, { button: 2 });
    expect(library).toBeInTheDocument();
    fireEvent.mouseDown(library, { button: 0 });
    expect(Boolean(screen.queryByRole("dialog", { name: "Asset Library" }))).toBe(!enabled);
    if (!enabled) fireEvent.click(within(library).getByRole("button", { name: "Close Asset Library" }));
    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    expect(store.getState().encounter).toBe(history);
  });
  it("does not dismiss the Library from a nested dialog backdrop", () => {
    const library = open({ libraryCloseOnOutsideClick: true });
    fireEvent.click(within(library).getByRole("button", { name: "Add to Encounters" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Create folder" }));
    fireEvent.mouseDown(screen.getByRole("dialog", { name: "Create folder" }));
    expect(library).toBeInTheDocument();
  });
  it.each([["list", "grid"], ["grid", "list"]])("uses independent modal=%s and panel=%s defaults", (modalView, panelView) => {
    const library = open({ libraryModalViewDefault: modalView, libraryPanelViewDefault: panelView });
    expect(within(library).getByRole("button", { name: `Switch library contents to ${modalView === "grid" ? "list" : "grid"} view` })).toBeInTheDocument();
    fireEvent.click(within(library).getByRole("button", { name: "Close Asset Library" }));
    expect(within(screen.getByRole("region", { name: "Library panel" })).getByRole("button", { name: `Switch Library to ${panelView === "grid" ? "list" : "one-column"} view` })).toBeInTheDocument();
  });
  it("remembers explicit choices while defaults apply to unvisited tabs", () => {
    const library = open({ libraryModalViewDefault: "list" });
    fireEvent.click(within(library).getByRole("button", { name: "Switch library contents to grid view" }));
    fireEvent.click(within(library).getByRole("button", { name: "Close Asset Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const reopened = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(reopened).getByRole("button", { name: "Switch library contents to list view" })).toBeInTheDocument();
    fireEvent.click(within(reopened).getByRole("tab", { name: "Tokens" }));
    expect(within(reopened).getByRole("button", { name: "Switch library contents to grid view" })).toBeInTheDocument();
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ libraryModalViewDefault: "grid" }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(within(reopened).getByRole("button", { name: "Switch library contents to list view" })).toBeInTheDocument();
  });
});
