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
});
