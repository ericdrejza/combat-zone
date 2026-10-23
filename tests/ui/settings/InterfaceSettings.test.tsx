import { Provider } from "react-redux";
import { store } from "@store/store";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { CanvasSettings } from "@ui/settings/CanvasSettings";
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

  function renderSettings(content = <InterfaceSettings />) {
    return render(
      <Provider store={store}>
      <ThemeProvider>
        <InterfacePreferenceProvider>
          {content}
        </InterfacePreferenceProvider>
      </ThemeProvider>
      </Provider>
    );
  }

  it.each(["box", "stack", "row"])("persists %s as the default clock style and resets to Traditional", (style) => {
    const view = renderSettings();
    const defaults = screen.getByRole("group", { name: "Status" });
    const select = within(defaults).getByRole("combobox", { name: "Default clock style" });
    expect(select).toHaveValue("traditional");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Box", "Row", "Stack", "Traditional"]);
    fireEvent.change(select, { target: { value: style } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ clockStyleDefault: style });
    view.unmount(); renderSettings();
    expect(screen.getByLabelText("Default clock style")).toHaveValue(style);
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "traditional" }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
    fireEvent.change(screen.getByLabelText("Default clock style"), { target: { value: style } });
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
  });
  it("uses Traditional for unknown saved clock style defaults", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "unknown" }));
    renderSettings(); expect(screen.getByLabelText("Default clock style")).toHaveValue("traditional");
  });
  it("defaults to system mode and persists a dark-mode selection", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
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
    const defaults = screen.getByRole("group", { name: "Initiative" });
    const autoSelect = within(defaults).getByRole("switch", {
      name: "Auto-select active actor in initiative"
    });
    const assetAnimation = within(accessibility).getByRole("switch", {
      name: "Enable animations"
    });
    expect(autoSelect).toBeChecked();
    expect(assetAnimation).toBeChecked();

    await user.click(autoSelect);
    await user.click(assetAnimation);
    expect(autoSelect).not.toBeChecked();
    expect(assetAnimation).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      backgroundResizeOverflowBehavior: "zoneless",
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
      panWithRightClickDrag: true,
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
    renderSettings(<CanvasSettings />);

    const defaults = screen.getByRole("group", { name: "New encounter defaults" });
    const toolSelect = within(defaults).getByRole("combobox", {
      name: "Tool auto-select upon encounter creation"
    });

    expect(toolSelect).toHaveValue("zone");
    await user.selectOptions(toolSelect, "background");

    expect(toolSelect).toHaveValue("background");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({ encounterCreationTool: "background" });
  });

  it("pairs panel visibility controls with their draggable default layout names", async () => {
    const user = userEvent.setup();
    renderSettings();
    const panels = screen.getByRole("region", { name: "Panels" });
    const visibility = within(panels).getByRole("group", { name: "Default layout and visibility" });
    const switches = within(visibility).getAllByRole("switch");

    expect(switches.map((control) => control.getAttribute("aria-label"))).toEqual([
      "Library panel visibility",
      "Properties panel visibility",
      "Log panel visibility",
      "Initiative panel visibility",
      "Status panel visibility",
      "Audio panel visibility"
    ]);
    for (const control of switches) {
      const title = control.getAttribute("aria-label")!.replace(" panel visibility", "");
      expect(within(control.closest("li")!).getByRole("button", { name: `Reorder ${title} panel` })).toBeInTheDocument();
    }
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

  it("only allows Zoneless layout dragging when it is in a sidebar and never offers a visibility setting", async () => {
    const user = userEvent.setup();
    renderSettings();
    const layout = screen.getByRole("group", { name: "Default layout and visibility" });
    const zoneless = within(layout).getByRole("button", { name: "Reorder Zoneless panel" });
    expect(zoneless).toBeDisabled();
    expect(within(layout).queryByRole("switch", { name: "Zoneless panel visibility" })).not.toBeInTheDocument();
    const before = localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    const target = screen.getByLabelText("Drop panel 0 in default right panel order");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    fireEvent.dragStart(zoneless, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)).toBe(before);
    await user.selectOptions(screen.getByRole("combobox", { name: "Zoneless panel location" }), "sidebar");
    expect(zoneless).toBeEnabled();
    expect(within(layout).queryByRole("switch", { name: "Zoneless panel visibility" })).not.toBeInTheDocument();
    fireEvent.dragStart(zoneless, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!).panelOrder.right[0]).toBe("zoneless");
  });

  it("persists panel order separately from encounter layouts", () => {
    renderSettings();
    const order = screen.getByRole("group", { name: "Default layout and visibility" });
    const left = within(order).getByRole("list", { name: "Default left panel order" });
    const right = within(order).getByRole("list", { name: "Default right panel order" });

    expect(within(left).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Library"),
      expect.stringContaining("Properties"),
      expect.stringContaining("Log"),
      expect.stringContaining("Zoneless")
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
          left: ["library", "properties", "audio", "log", "zoneless"],
          right: ["initiative", "status"]
        }
      });
  });

  it("loads the saved theme and returns to system when preferences reset", () => {
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

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Library panel visibility" })
    ).toBeChecked();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
