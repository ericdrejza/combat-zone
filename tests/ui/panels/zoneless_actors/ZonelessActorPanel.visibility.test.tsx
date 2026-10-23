import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { actor, seedEncounter } from "./ZonelessActorPanel.test_support";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { readPreferences } from "@ui/interface_preferences/interfacePreferenceStorage";

it("hides explicitly, preserves expansion and grouping, and does not reveal on hover", async () => {
  const user = userEvent.setup();
  renderApp();
  act(() => { seedEncounter([actor("a", "Aria")]); store.dispatch(setActiveTool("actor")); });
  const before = store.getState().encounter;
  await user.click(screen.getByRole("button", { name: "Toggle Zoneless panel from header" }));
  await user.click(screen.getByRole("button", { name: "Group by faction" }));
  const sidebar = screen.getByRole("complementary", { name: "left sidebar" });
  expect(within(sidebar).getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  await user.click(within(sidebar).getByRole("button", { name: "Hide Zoneless panel" }));
  expect(screen.queryByRole("complementary", { name: "Zoneless actors" })).not.toBeInTheDocument();
  await user.click(within(sidebar).getByRole("button", { name: "Collapse left sidebar" }));
  const show = within(sidebar).getByRole("button", { name: "Show Zoneless panel" });
  await user.hover(show);
  expect(screen.queryByRole("complementary", { name: "Zoneless actors" })).not.toBeInTheDocument();
  await user.click(show);
  expect(screen.getByRole("button", { name: "Collapse zoneless actors" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Group by faction" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Aria" })).toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});

it("honors synchronized header settings while preserving the chevron", async () => {
  renderApp();
  const write = (value: unknown) => act(() => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ zonelessHeaderClickExpansion: value }));
    window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY }));
  });
  write(false);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Toggle Zoneless panel from header" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Expand zoneless actors" }));
  expect(screen.getByRole("button", { name: "Collapse zoneless actors" })).toBeInTheDocument();
  write(true);
  fireEvent.click(screen.getByRole("button", { name: "Toggle Zoneless panel from header" }));
  expect(screen.getByRole("button", { name: "Expand zoneless actors" })).toBeInTheDocument();
  write("invalid");
  expect(readPreferences().zonelessHeaderClickExpansion).toBe(true);
});
