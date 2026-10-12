import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

describe("Library settings in the application", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("updates the shared slider and switches to editable independent sizes", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Interface" }));
    const slider = within(dialog).getByRole("slider", { name: "Library grid card size" });
    fireEvent.input(slider, { target: { value: "3" } });
    expect(slider).toHaveValue("3");
    expect(slider).toHaveAttribute("aria-valuetext", "Extra large");
    fireEvent.click(within(dialog).getByRole("switch", { name: "Independent Library grid card sizes" }));
    expect(within(dialog).queryByRole("slider", { name: "Library grid card size" })).not.toBeInTheDocument();
    const tokenSlider = within(dialog).getByRole("slider", { name: "Character and Token grid card size" });
    fireEvent.input(tokenSlider, { target: { value: "0" } });
    expect(tokenSlider).toHaveValue("0");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      libraryGridCardSize: 256,
      libraryIndependentGridCardSizes: true,
      libraryGridCardSizes: { tokens: 80 }
    });
  });
});
