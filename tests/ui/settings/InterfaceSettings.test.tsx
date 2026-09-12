import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { InterfaceSettings } from "@ui/settings/InterfaceSettings";
import {
  DEFAULT_ZONE_COLOR_DEFAULTS,
  INTERFACE_PREFERENCES_STORAGE_KEY,
  InterfacePreferenceProvider
} from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  THEME_STORAGE_KEY,
  ThemeProvider
} from "@ui/theme/ThemeProvider";
import { DEFAULT_DOCKABLE_PANEL_VISIBILITY } from "@ui/panels/dockablePanelMetadata";

describe("InterfaceSettings", () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
  });

  function renderSettings() {
    return render(
      <ThemeProvider>
        <InterfacePreferenceProvider>
          <InterfaceSettings />
        </InterfacePreferenceProvider>
      </ThemeProvider>
    );
  }

  it("defaults to light mode and persists a dark-mode selection", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("groups enabled interface preferences and persists toggle changes", async () => {
    const user = userEvent.setup();
    renderSettings();

    const general = screen.getByRole("group", { name: "General" });
    const defaults = screen.getByRole("group", { name: "Defaults" });
    const autoSelect = within(defaults).getByRole("switch", {
      name: "Auto-select active actor in initiative"
    });
    const pan = within(general).getByRole("switch", {
      name: "Pan with right-click drag"
    });
    expect(autoSelect).toBeChecked();
    expect(pan).toBeChecked();

    await user.click(autoSelect);
    await user.click(pan);
    expect(autoSelect).not.toBeChecked();
    expect(pan).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toEqual({
      autoSelectActiveActor: false,
      panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
      panWithRightClickDrag: false,
      zoneColorDefaults: DEFAULT_ZONE_COLOR_DEFAULTS,
      zoneOpacityDefault: 0.7,
      zoneShowBorderDefault: true
    });
  });

  it("persists valid default colors and allows engagements to match the border", async () => {
    const user = userEvent.setup();
    renderSettings();

    const defaults = screen.getByRole("group", { name: "Defaults" });
    const zoneColor = within(defaults).getByRole("textbox", {
      name: "Default zone color"
    });
    const borderColor = within(defaults).getByRole("textbox", {
      name: "Default border color"
    });
    const zoneOpacity = within(defaults).getByRole("slider", {
      name: "Default zone opacity"
    });
    const engagementColor = within(defaults).getByRole("textbox", {
      name: "Default engagements color"
    });
    const showBorder = within(defaults).getByRole("switch", {
      name: "Show border"
    });

    expect(zoneColor).toHaveValue("");
    expect(zoneColor).toHaveAttribute("placeholder", "#ffffff");
    expect(zoneOpacity).toHaveValue("0.7");
    expect(within(defaults).getByText("70%")).toBeInTheDocument();
    expect(borderColor).toHaveValue("");
    expect(borderColor).toHaveAttribute("placeholder", "#ffffff");
    expect(engagementColor).toHaveValue("");
    expect(engagementColor).toHaveAttribute("placeholder", "#ffffff");
    expect(showBorder).toBeChecked();

    await user.clear(zoneColor);
    await user.type(zoneColor, "#ABCDEF{Enter}");
    fireEvent.change(zoneOpacity, { target: { value: "0.6" } });
    await user.click(showBorder);
    await user.type(engagementColor, "#FED7AA{Enter}");

    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({
        zoneColorDefaults: {
          border: null,
          engagement: "#fed7aa",
          zone: "#abcdef"
        },
        zoneOpacityDefault: 0.6,
        zoneShowBorderDefault: false
      });

    await user.clear(engagementColor);
    await user.type(engagementColor, "{Enter}");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({ zoneColorDefaults: { engagement: null } });

    await user.type(borderColor, "#123456{Enter}");
    expect(engagementColor).toHaveAttribute("placeholder", "#123456");

    await user.clear(zoneColor);
    await user.type(zoneColor, "{Enter}");
    await user.clear(borderColor);
    await user.type(borderColor, "{Enter}");
    expect(zoneColor).toHaveAttribute("placeholder", "#ffffff");
    expect(borderColor).toHaveAttribute("placeholder", "#ffffff");
    expect(engagementColor).toHaveAttribute("placeholder", "#ffffff");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({
        zoneColorDefaults: { border: null, engagement: null, zone: null }
      });

    await user.type(borderColor, "invalid{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("six-digit hex color");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({ zoneColorDefaults: { border: null } });
  });

  it("lists panel visibility controls alphabetically with eye icons", async () => {
    const user = userEvent.setup();
    renderSettings();
    const panels = screen.getByRole("group", { name: "Panel Visibility" });
    const switches = within(panels).getAllByRole("switch");

    expect(switches.map((control) => control.getAttribute("aria-label"))).toEqual([
      "Initiative panel visibility",
      "Library panel visibility",
      "Log panel visibility",
      "Properties panel visibility",
      "Status panel visibility"
    ]);
    expect(switches.every((control) => control.getAttribute("aria-checked") === "true")).toBe(true);
    expect(switches.every((control) => control.querySelector(".lucide-eye"))).toBe(true);

    await user.click(within(panels).getByRole("switch", {
      name: "Library panel visibility"
    }));
    const libraryVisibility = within(panels).getByRole("switch", {
      name: "Library panel visibility"
    });
    expect(libraryVisibility).toHaveAttribute("aria-checked", "false");
    expect(libraryVisibility.querySelector(".lucide-eye-off")).not.toBeNull();
  });

  it("loads the saved theme and returns to light when preferences reset", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        panelVisibility: {
          ...DEFAULT_DOCKABLE_PANEL_VISIBILITY,
          library: false
        }
      })
    );
    renderSettings();

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Library panel visibility" })
    ).not.toBeChecked();
    act(() => {
      globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
    });

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Library panel visibility" })
    ).toBeChecked();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
