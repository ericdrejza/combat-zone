import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { InterfaceSettings } from "@ui/settings/InterfaceSettings";
import {
  THEME_STORAGE_KEY,
  ThemeProvider
} from "@ui/theme/ThemeProvider";

describe("InterfaceSettings", () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
  });

  function renderSettings() {
    return render(
      <ThemeProvider>
        <InterfaceSettings />
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

  it("loads the saved theme and returns to light when preferences reset", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderSettings();

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    act(() => {
      globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
    });

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
