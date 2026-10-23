import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from "@ui/theme/ThemeProvider";
import { ThemeSettings } from "@ui/settings/ThemeSettings";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";

let media: EventTarget & { matches: boolean; addEventListener: EventTarget["addEventListener"]; removeEventListener: EventTarget["removeEventListener"] };
beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
});
afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});
function Probe() {
  const { theme } = useTheme();
  return <output aria-label="Resolved theme">{theme}</output>;
}
function setup() { return render(<ThemeProvider><ThemeSettings /><Probe /></ThemeProvider>); }
function systemChange(dark: boolean) {
  act(() => { media.matches = dark; media.dispatchEvent(new Event("change")); });
}

it("defaults to System, follows device changes, and exposes the resolved theme to consumers", () => {
  setup();
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  systemChange(false);
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
});
it.each(["light", "dark"])("preserves saved %s and ignores device changes until System is selected", saved => {
  localStorage.setItem(THEME_STORAGE_KEY, saved);
  setup();
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent(saved);
  systemChange(false);
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent(saved);
  fireEvent.click(screen.getByRole("radio", { name: "System" }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("light");
  systemChange(true);
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("dark");
});
it("synchronizes across tabs, resets to System, and reloads System", () => {
  const view = setup();
  act(() => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
  });
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("light");
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("dark");
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(screen.getByRole("radio", { name: "System" }));
  view.unmount();
  setup();
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
});
it("uses System for an invalid saved theme and works without matchMedia", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "unknown");
  vi.stubGlobal("matchMedia", undefined);
  setup();
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  expect(screen.getByLabelText("Resolved theme")).toHaveTextContent("light");
});
it("removes the device listener on unmount", () => {
  const remove = vi.spyOn(media, "removeEventListener");
  const view = setup();
  view.unmount();
  expect(remove).toHaveBeenCalledWith("change", expect.any(Function));
});
