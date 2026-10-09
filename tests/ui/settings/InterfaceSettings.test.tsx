import { Provider } from "react-redux";
import { store } from "@store/store";
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
import { DEFAULT_ENCOUNTER_PANEL_ORDER } from "@core/encounter/panelLayout";

describe("InterfaceSettings", () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
  });

  function renderSettings() {
    return render(
      <Provider store={store}>
      <ThemeProvider>
        <InterfacePreferenceProvider>
          <InterfaceSettings />
        </InterfacePreferenceProvider>
      </ThemeProvider>
      </Provider>
    );
  }

  it("persists the default clock style in Defaults, synchronizes changes, and resets to Traditional", () => {
    const view = renderSettings();
    const defaults = screen.getByRole("group", { name: "Defaults" });
    const select = within(defaults).getByRole("combobox", { name: "Default clock style" });
    expect(select).toHaveValue("traditional");
    fireEvent.change(select, { target: { value: "linear" } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ clockStyleDefault: "linear" });
    view.unmount(); renderSettings();
    expect(screen.getByLabelText("Default clock style")).toHaveValue("linear");
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "traditional" }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
    fireEvent.change(screen.getByLabelText("Default clock style"), { target: { value: "linear" } });
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
  });
  it("uses Traditional for unknown saved clock style defaults", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "unknown" }));
    renderSettings(); expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
  });
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

    const accessibility = screen.getByRole("group", { name: "Accessibility" });
    const navigation = screen.getByRole("group", { name: "Navigation" });
    const defaults = screen.getByRole("group", { name: "Defaults" });
    const autoSelect = within(defaults).getByRole("switch", {
      name: "Auto-select active actor in initiative"
    });
    const pan = within(navigation).getByRole("switch", {
      name: "Pan with right-click drag"
    });
    const assetAnimation = within(accessibility).getByRole("switch", {
      name: "Enable animations"
    });
    expect(autoSelect).toBeChecked();
    expect(assetAnimation).toBeChecked();
    expect(pan).toBeChecked();

    await user.click(autoSelect);
    await user.click(assetAnimation);
    await user.click(pan);
    expect(autoSelect).not.toBeChecked();
    expect(assetAnimation).not.toBeChecked();
    expect(pan).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toEqual({
      healthCounterName: "Hit points",
      clockStyleDefault: "traditional",
      audioMasterVolume: 1,
      audioCueVolumeDefault: 0.5,
      audioMediaKeyScope: "music",
      audioRepeatDelayDefaults: {
        minimumDelaySeconds: 0,
        maximumDelaySeconds: 0
      },
      autoSelectActiveActor: false,
      enableAssetAnimation: false,
      encounterCreationTool: "zone",
      panelOrder: DEFAULT_ENCOUNTER_PANEL_ORDER,
      panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
      panWithRightClickDrag: false,
      warnActorDestinationsDiffer: true,
      keepHealDamageDialogOpen: false,
      strikethroughDeadInitiativeNames: true,
      zoneColorDefaults: DEFAULT_ZONE_COLOR_DEFAULTS,
      zoneOpacityDefault: 0.7,
      zoneShowBorderDefault: true
    });
  });

  it("persists the default tool for newly created encounters", async () => {
    const user = userEvent.setup();
    renderSettings();

    const defaults = screen.getByRole("group", { name: "Defaults" });
    const toolSelect = within(defaults).getByRole("combobox", {
      name: "Tool auto-select upon encounter creation"
    });

    expect(toolSelect).toHaveValue("zone");
    await user.selectOptions(toolSelect, "background");

    expect(toolSelect).toHaveValue("background");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({ encounterCreationTool: "background" });
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
      name: "Show border by default"
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

  it("groups panel visibility under Panels and lists controls alphabetically", async () => {
    const user = userEvent.setup();
    renderSettings();
    const panels = screen.getByRole("region", { name: "Panels" });
    const visibility = within(panels).getByRole("group", { name: "Visibility" });
    const switches = within(visibility).getAllByRole("switch");

    expect(switches.map((control) => control.getAttribute("aria-label"))).toEqual([
      "Audio panel visibility",
      "Initiative panel visibility",
      "Library panel visibility",
      "Log panel visibility",
      "Properties panel visibility",
      "Status panel visibility"
    ]);
    expect(switches.every((control) => control.getAttribute("aria-checked") === "true")).toBe(true);
    expect(switches.every((control) => control.querySelector(".lucide-eye"))).toBe(true);

    await user.click(within(visibility).getByRole("switch", {
      name: "Library panel visibility"
    }));
    const libraryVisibility = within(visibility).getByRole("switch", {
      name: "Library panel visibility"
    });
    expect(libraryVisibility).toHaveAttribute("aria-checked", "false");
    expect(libraryVisibility.querySelector(".lucide-eye-off")).not.toBeNull();
  });

  it("persists panel order separately from encounter layouts", () => {
    renderSettings();
    const order = screen.getByRole("group", { name: "Order" });
    const left = within(order).getByRole("list", { name: "Default left panel order" });
    const right = within(order).getByRole("list", { name: "Default right panel order" });

    expect(within(left).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Library"),
      expect.stringContaining("Properties"),
      expect.stringContaining("Log")
    ]);
    expect(within(right).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Initiative"),
      expect.stringContaining("Status"),
      expect.stringContaining("Audio")
    ]);

    expect(within(order).queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
    const audio = within(order).getByRole("button", { name: "Reorder Audio panel" });
    const target = screen.getByLabelText("Drop panel 2 in default left panel order");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    fireEvent.dragStart(audio, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    expect(target.firstElementChild).toHaveAttribute("aria-hidden", "false");
    fireEvent.drop(target, { dataTransfer });
    expect(target.firstElementChild).toHaveAttribute("aria-hidden", "true");

    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({
        panelOrder: {
          left: ["library", "properties", "audio", "log"],
          right: ["initiative", "status"]
        }
      });
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
