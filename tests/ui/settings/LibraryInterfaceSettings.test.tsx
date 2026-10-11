import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { LibraryInterfaceSettings } from "@ui/settings/LibraryInterfaceSettings";

const renderSettings = () => render(<InterfacePreferenceProvider><LibraryInterfaceSettings /></InterfacePreferenceProvider>);

describe("Library Interface preferences", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("persists separate defaults, outside-click dismissal and card size, and restores reset defaults", () => {
    const view = renderSettings();
    expect(screen.getByRole("switch", { name: "Close Library modal when clicking outside" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Library modal view" })).toHaveValue("grid");
    expect(screen.getByRole("combobox", { name: "Default Library panel view" })).toHaveValue("grid");
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("128");
    fireEvent.click(screen.getByRole("switch", { name: "Close Library modal when clicking outside" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Default Library modal view" }), { target: { value: "list" } });
    fireEvent.change(screen.getByRole("slider", { name: "Library grid card size" }), { target: { value: "256" } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ libraryCloseOnOutsideClick: true, libraryModalViewDefault: "list", libraryPanelViewDefault: "grid", libraryGridCardSize: 256 });
    view.unmount(); renderSettings();
    expect(screen.getByRole("switch", { name: "Close Library modal when clicking outside" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Library modal view" })).toHaveValue("list");
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("256");
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ libraryModalViewDefault: "grid", libraryPanelViewDefault: "list", libraryGridCardSize: 80 }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByRole("combobox", { name: "Default Library modal view" })).toHaveValue("grid");
    expect(screen.getByRole("combobox", { name: "Default Library panel view" })).toHaveValue("list");
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("80");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("switch", { name: "Close Library modal when clicking outside" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Library panel view" })).toHaveValue("grid");
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("128");
  });
  it("retains shared and independent sizes across toggles, reload, synchronization and reset", () => {
    const view = renderSettings();
    const toggle = () => screen.getByRole("switch", { name: "Independent Library grid card sizes" });
    expect(toggle()).not.toBeChecked();
    fireEvent.change(screen.getByRole("slider", { name: "Library grid card size" }), { target: { value: "160" } });
    fireEvent.click(toggle());
    expect(screen.queryByRole("slider", { name: "Library grid card size" })).not.toBeInTheDocument();
    const labels = ["Encounter", "Background", "Token", "Audio"];
    const sizes = [80, 144, 192, 256];
    labels.forEach((label, index) => {
      const slider = screen.getByRole("slider", { name: `${label} grid card size` });
      expect(slider).toHaveValue("128");
      fireEvent.change(slider, { target: { value: String(sizes[index]) } });
    });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      libraryIndependentGridCardSizes: true, libraryGridCardSize: 160,
      libraryGridCardSizes: { encounters: 80, backgrounds: 144, tokens: 192, audio: 256 }
    });
    fireEvent.click(toggle());
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("160");
    fireEvent.click(toggle());
    view.unmount(); renderSettings();
    expect(toggle()).toBeChecked();
    labels.forEach((label, index) => expect(screen.getByRole("slider", { name: `${label} grid card size` })).toHaveValue(String(sizes[index])));
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ libraryIndependentGridCardSizes: true, libraryGridCardSizes: { audio: 100 } }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByRole("slider", { name: "Audio grid card size" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Token grid card size" })).toHaveValue("128");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(toggle()).not.toBeChecked();
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("128");
    fireEvent.click(toggle());
    labels.forEach((label) => expect(screen.getByRole("slider", { name: `${label} grid card size` })).toHaveValue("128"));
  });
  it("validates individual card sizes without discarding other valid sizes", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ libraryIndependentGridCardSizes: "true", libraryGridCardSizes: { encounters: 0, backgrounds: "100", tokens: 257, audio: 180 } }));
    renderSettings();
    const toggle = screen.getByRole("switch", { name: "Independent Library grid card sizes" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    for (const label of ["Encounter", "Background", "Token"]) expect(screen.getByRole("slider", { name: `${label} grid card size` })).toHaveValue("128");
    expect(screen.getByRole("slider", { name: "Audio grid card size" })).toHaveValue("180");
  });
  it("rejects invalid stored values", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ libraryCloseOnOutsideClick: "true", libraryModalViewDefault: "other", libraryPanelViewDefault: "other", libraryGridCardSize: 400 }));
    renderSettings();
    expect(screen.getByRole("switch", { name: "Close Library modal when clicking outside" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Library modal view" })).toHaveValue("grid");
    expect(screen.getByRole("combobox", { name: "Default Library panel view" })).toHaveValue("grid");
    expect(screen.getByRole("slider", { name: "Library grid card size" })).toHaveValue("128");
  });
});
