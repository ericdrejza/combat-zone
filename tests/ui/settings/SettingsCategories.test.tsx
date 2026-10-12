import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

const backgroundLabel = "When background resizing puts actors outside the canvas";
const warningLabel = "Warn when actor destinations differ";
const healLabel = "Keep heal/damage dialog open after application";
const panLabel = "Pan with right-click drag";

describe("Settings categories", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("places combat and canvas preferences in their categories and retains their saved values", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      warnActorDestinationsDiffer: false, keepHealDamageDialogOpen: true,
      panWithRightClickDrag: false, backgroundResizeOverflowBehavior: "clamp"
    }));
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    const selectTab = (name: string) => fireEvent.click(within(dialog).getByRole("tab", { name }));
    selectTab("Interface");
    expect(within(dialog).queryByRole("group", { name: "Navigation" })).not.toBeInTheDocument();
    for (const name of [warningLabel, healLabel, panLabel]) {
      expect(within(dialog).queryByRole("switch", { name })).not.toBeInTheDocument();
    }
    expect(within(dialog).queryByRole("combobox", { name: backgroundLabel })).not.toBeInTheDocument();
    selectTab("Canvas");
    const navigation = within(dialog).getByRole("group", { name: "Navigation" });
    expect(within(navigation).getAllByRole("switch")).toHaveLength(1);
    const pan = within(navigation).getByRole("switch", { name: panLabel });
    expect(pan).not.toBeChecked();
    expect(within(navigation).queryByRole("combobox")).not.toBeInTheDocument();
    const backgroundSection = within(dialog).getByRole("group", { name: "Background" });
    const background = within(backgroundSection).getByRole("combobox", { name: backgroundLabel });
    expect(background).toHaveValue("clamp");
    fireEvent.click(pan);
    fireEvent.change(background, { target: { value: "zoneless" } });
    selectTab("Combat");
    const warning = within(dialog).getByRole("switch", { name: warningLabel });
    const heal = within(dialog).getByRole("switch", { name: healLabel });
    expect(warning).not.toBeChecked();
    expect(heal).toBeChecked();
    fireEvent.click(warning);
    fireEvent.click(heal);
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      warnActorDestinationsDiffer: true, keepHealDamageDialogOpen: false,
      panWithRightClickDrag: true, backgroundResizeOverflowBehavior: "zoneless"
    });
    selectTab("Canvas");
    expect(within(dialog).getByRole("switch", { name: panLabel })).toBeChecked();
    expect(within(dialog).getByRole("combobox", { name: backgroundLabel })).toHaveValue("zoneless");
  });
  it("restores the category and scroll position on reopen without persisting navigation", () => {
    const view = renderApp();
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    open();
    expect(screen.getByRole("tablist", { name: "Workspace settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Interface" }));
    fireEvent.scroll(screen.getByRole("tabpanel"), { target: { scrollTop: 420 } });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    open();
    expect(screen.getByRole("tab", { name: "Interface" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel").scrollTop).toBe(420);
    fireEvent.click(screen.getByRole("tab", { name: "Audio" }));
    expect(screen.getByRole("tabpanel").scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("tab", { name: "Interface" }));
    expect(screen.getByRole("tabpanel").scrollTop).toBe(420);
    view.unmount();
    renderApp();
    open();
    expect(screen.getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel").scrollTop).toBe(0);
  });

  it("groups defaults and panel presentation in their assigned categories", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(screen.getByRole("tab", { name: "Canvas" }));
    expect(within(screen.getByRole("group", { name: "New encounter defaults" }))
      .getByRole("combobox", { name: "Tool auto-select upon encounter creation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Combat" }));
    const health = within(screen.getByRole("group", { name: "Health" }));
    expect(health.getByRole("textbox", { name: "Health counter name" })).toHaveAccessibleDescription(/Saves when you leave/);
    expect(screen.queryByRole("switch", { name: "Show conditions" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Interface" }));
    const initiative = within(screen.getByRole("group", { name: "Initiative" }));
    expect(initiative.getByRole("switch", { name: "Auto-select active actor in initiative" })).toBeInTheDocument();
    expect(initiative.getByRole("switch", { name: "Strikethrough dead actor names in initiative" })).toBeInTheDocument();
    const status = within(screen.getByRole("group", { name: "Status" }));
    expect(status.getByRole("switch", { name: "Show conditions" })).toBeInTheDocument();
    expect(status.getByRole("combobox", { name: "Default clock style" })).toHaveAccessibleDescription(/new clocks/);
    expect(screen.queryByRole("textbox", { name: "Health counter name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tool auto-select upon encounter creation" })).not.toBeInTheDocument();
  });

});
