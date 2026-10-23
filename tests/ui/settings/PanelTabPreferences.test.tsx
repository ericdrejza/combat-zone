import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@tests/ui/renderApp";
import { store } from "@store/store";
import { InterfacePreferenceProvider, useInterfacePreferences, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { readPreferences } from "@ui/interface_preferences/interfacePreferenceStorage";

function Probe() {
  const preferences = useInterfacePreferences();
  return <>
    <output aria-label="Tab setting">{String(preferences.panelTabMode)}</output>
    <output aria-label="Zoneless setting">{preferences.zonelessPanelPlacement}</output>
    <button onClick={() => preferences.resetCategory("interface")}>Reset interface</button>
  </>;
}
afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

it("persists the Interface toggle without adding history and restores it on remount", async () => {
  const user = userEvent.setup();
  const view = renderApp();
  const before = store.getState().encounter;
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  await user.click(screen.getByRole("tab", { name: "Interface" }));
  const toggle = screen.getByRole("switch", { name: "Panel Tabs" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  await user.click(toggle);
  expect(readPreferences().panelTabMode).toBe(true);
  expect(screen.getByRole("combobox", { name: "Zoneless panel location" })).toBeEnabled();
  expect(store.getState().encounter).toBe(before);
  view.unmount();
  render(<InterfacePreferenceProvider><Probe /></InterfacePreferenceProvider>);
  expect(screen.getByLabelText("Tab setting")).toHaveTextContent("true");
});

it("synchronizes tab and Zoneless preferences across tabs and resets them", async () => {
  const user = userEvent.setup();
  render(<InterfacePreferenceProvider><Probe /></InterfacePreferenceProvider>);
  act(() => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode: true, zonelessPanelPlacement: "sidebar" }));
    window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY }));
  });
  expect(screen.getByLabelText("Tab setting")).toHaveTextContent("true");
  expect(screen.getByLabelText("Zoneless setting")).toHaveTextContent("sidebar");
  await user.click(screen.getByRole("button", { name: "Reset interface" }));
  expect(readPreferences().panelTabMode).toBe(false);
  expect(readPreferences().zonelessPanelPlacement).toBe("canvas");
});

it("defaults invalid stored values safely and upgrades the older six-panel order without losing its sides", () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
    panelTabMode: "true", zonelessPanelPlacement: "unknown",
    panelOrder: { left: ["status", "log"], right: ["audio", "initiative", "properties", "library"] }
  }));
  const preferences = readPreferences();
  expect(preferences.panelTabMode).toBe(false);
  expect(preferences.zonelessPanelPlacement).toBe("canvas");
  expect(preferences.panelOrder.left).toEqual(["status", "log", "zoneless"]);
  expect(preferences.panelOrder.right).toEqual(["audio", "initiative", "properties", "library"]);
});
