import { fireEvent, screen } from "@testing-library/react";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

it.each([false, true])("toggles both sidebars together without changing encounter history (tabs: %s)", panelTabMode => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode }));
  renderApp();
  const encounter = store.getState().encounter;
  fireEvent.keyDown(window, { key: "q" });
  expect(screen.getByRole("button", { name: "Expand left sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expand right sidebar" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "q", repeat: true });
  expect(screen.getByRole("button", { name: "Expand left sidebar" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "q" });
  expect(screen.getByRole("button", { name: "Collapse left sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Collapse right sidebar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse left sidebar" }));
  fireEvent.keyDown(window, { key: "q" });
  expect(screen.getByRole("button", { name: "Expand left sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expand right sidebar" })).toBeInTheDocument();
  expect(store.getState().encounter).toBe(encounter);
});

it("ignores typing and modal workflows", () => {
  renderApp();
  const input = document.createElement("input");
  document.body.append(input);
  fireEvent.keyDown(input, { key: "q" });
  input.remove();
  expect(screen.getByRole("button", { name: "Collapse left sidebar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
  fireEvent.keyDown(window, { key: "q" });
  expect(screen.getByRole("button", { name: "Collapse left sidebar" })).toBeInTheDocument();
});

it("counts only sidebars with visible panels when deciding whether to expand", () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
    panelVisibility: { library: false, properties: false, log: false }
  }));
  renderApp();
  fireEvent.click(screen.getByRole("button", { name: "Collapse right sidebar" }));
  fireEvent.keyDown(window, { key: "q" });
  expect(screen.getByRole("button", { name: "Collapse right sidebar" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Expand left sidebar" })).not.toBeInTheDocument();
});
