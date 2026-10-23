import { act, fireEvent, render, screen } from "@testing-library/react";
import { InterfacePreferenceProvider, useInterfacePreferences, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { PanelInterfaceSettings } from "@ui/settings/PanelInterfaceSettings";
import { Provider } from "react-redux";
import { store } from "@store/store";

function ResetInterface() {
  const { resetCategory } = useInterfacePreferences();
  return <button onClick={() => resetCategory("interface")}>Reset interface</button>;
}

afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

it("persists header expansion, restores it on mount, and resets with Interface and application preferences", () => {
  const mount = () => render(<Provider store={store}><InterfacePreferenceProvider><PanelInterfaceSettings /><ResetInterface /></InterfacePreferenceProvider></Provider>);
  let view = mount();
  const control = () => screen.getByRole("switch", { name: "Click Zoneless header to expand or collapse" });
  expect(control()).toBeChecked();
  fireEvent.click(control());
  expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ zonelessHeaderClickExpansion: false });
  view.unmount();
  view = mount();
  expect(control()).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Reset interface" }));
  expect(control()).toBeChecked();
  fireEvent.click(control());
  act(() => { window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)); });
  expect(control()).toBeChecked();
});
