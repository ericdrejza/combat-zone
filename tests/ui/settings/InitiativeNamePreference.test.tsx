import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";

import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { InterfaceSettings } from "@ui/settings/InterfaceSettings";

const label = "Strikethrough dead actor names in initiative";

function renderSettings() {
  return render(<Provider store={store}><InterfacePreferenceProvider><InterfaceSettings /></InterfacePreferenceProvider></Provider>);
}

beforeEach(() => { resetAppStore(); localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); });
afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

describe("initiative name decoration preference", () => {
  it("defaults on at the bottom of Panels and persists toggles without encounter history", () => {
    const view = renderSettings();
    const panels = screen.getByRole("region", { name: "Panels" });
    const controls = within(panels).getAllByRole("switch");
    const setting = within(panels).getByRole("switch", { name: label });
    expect(controls.at(-1)).toBe(setting);
    expect(setting).toHaveAttribute("aria-checked", "true");
    const encounterHistory = store.getState().encounter;
    fireEvent.click(setting);
    expect(setting).toHaveAttribute("aria-checked", "false");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ strikethroughDeadInitiativeNames: false });
    expect(store.getState().encounter).toBe(encounterHistory);
    view.unmount();
    renderSettings();
    const reloaded = screen.getByRole("switch", { name: label });
    expect(reloaded).toHaveAttribute("aria-checked", "false");
    fireEvent.click(reloaded);
    expect(reloaded).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ strikethroughDeadInitiativeNames: true });
  });

  it.each([{}, { strikethroughDeadInitiativeNames: "false" }])("defaults older or malformed saved values to on (%j)", (stored) => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify(stored));
    renderSettings();
    expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-checked", "true");
  });

  it("restores the enabled default on preference reset", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ strikethroughDeadInitiativeNames: false }));
    renderSettings();
    expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-checked", "false");
    act(() => globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-checked", "true");
  });
});
