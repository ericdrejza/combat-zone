import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it } from "vitest";
import { InterfacePreferenceProvider, useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { INTERFACE_PREFERENCES_STORAGE_KEY, readPreferences } from "@ui/interface_preferences/interfacePreferenceStorage";
import { ChatSettings } from "@ui/settings/ChatSettings";
import { ChatComposer } from "@ui/panels/ChatComposer";
import { store } from "@store/store";
import { resetEncounterState } from "@store/encounterSlice";

beforeEach(() => { localStorage.clear(); store.dispatch(resetEncounterState()); });
it("persists browser chat settings and captures the selected name color on new messages", () => {
  render(<Provider store={store}><InterfacePreferenceProvider><ChatSettings /><ChatComposer /></InterfacePreferenceProvider></Provider>);
  const color = screen.getByRole("textbox", { name: "Chat name color" });
  fireEvent.change(color, { target: { value: "#123456" } });
  fireEvent.blur(color);
  fireEvent.click(screen.getByRole("switch", { name: "Match message text to sender name color" }));
  expect(readPreferences()).toMatchObject({ chatNameColor: "#123456", chatMatchMessageColor: true });
  fireEvent.change(screen.getByRole("textbox", { name: "Chat message" }), { target: { value: "Colored sender" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  const messages = store.getState().encounter.present.chatMessages;
  expect(messages.byId[messages.allIds[0]].sender.color).toBe("#123456");
});
it("ignores malformed stored color settings", () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ chatNameColor: "red", chatMatchMessageColor: "true" }));
  expect(readPreferences()).toMatchObject({ chatNameColor: null, chatMatchMessageColor: false });
});

function ResetInterface() {
  const { resetCategory } = useInterfacePreferences();
  return <button onClick={() => resetCategory("interface")}>Reset interface</button>;
}
it("resets chat settings with the Interface category", () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ chatNameColor: "#123456", chatMatchMessageColor: true }));
  render(<InterfacePreferenceProvider><ChatSettings /><ResetInterface /></InterfacePreferenceProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Reset interface" }));
  expect(readPreferences()).toMatchObject({ chatNameColor: null, chatMatchMessageColor: false });
});
