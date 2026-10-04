import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { AudioSettings } from "@ui/settings/AudioSettings";
import { AUDIO_REPEAT_DELAYS } from "@ui/audio/audioRepeatDelay";

const renderSettings = () => render(<InterfacePreferenceProvider><AudioSettings /></InterfacePreferenceProvider>);
describe("new cue defaults", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("omits cue-type settings and their persisted data", () => {
    renderSettings();
    expect(screen.queryByText("Default cue types")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /default cue type/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Default cue volume" }), { target: { value: "20" } });
    const stored = JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!);
    expect(stored).not.toHaveProperty("audioCueTypeDefaults");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    fireEvent.change(screen.getByRole("slider", { name: "Default cue volume" }), { target: { value: "20" } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).not.toHaveProperty("audioCueTypeDefaults");
  });
  it("persists muted volume and allowed delays, normalizes the range, and resets defaults", () => {
    const first = renderSettings();
    const minimum = screen.getByRole("combobox", { name: "Default Effect repeat delay from" });
    const maximum = screen.getByRole("combobox", { name: "Default Effect repeat delay to" });
    expect(minimum).toHaveValue("0");
    expect(maximum).toHaveValue("0");
    expect(within(minimum).getAllByRole("option").map((option) => Number((option as HTMLOptionElement).value))).toEqual(AUDIO_REPEAT_DELAYS);
    expect(within(maximum).getAllByRole("option")).toHaveLength(AUDIO_REPEAT_DELAYS.length);
    fireEvent.change(screen.getByRole("slider", { name: "Default cue volume" }), { target: { value: "0" } });
    fireEvent.change(minimum, { target: { value: "120" } });
    expect(maximum).toHaveValue("120");
    fireEvent.change(minimum, { target: { value: "0" } });
    first.unmount();
    renderSettings();
    expect(screen.getByRole("slider", { name: "Default cue volume" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("120");
    expect(screen.getByText(/By default, repeated effects will repeat their sound every/)).toBeInTheDocument();
    act(() => globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("slider", { name: "Default cue volume" })).toHaveValue("50");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("0");
  });
  it("rejects unsupported persisted delay choices and invalid volume", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      audioCueVolumeDefault: 2,
      audioRepeatDelayDefaults: { minimumDelaySeconds: 7, maximumDelaySeconds: 99 }
    }));
    renderSettings();
    expect(screen.getByRole("slider", { name: "Default cue volume" })).toHaveValue("50");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("0");
  });
  it("preserves an existing saved repeat-delay preference", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      audioRepeatDelayDefaults: { minimumDelaySeconds: 30, maximumDelaySeconds: 60 }
    }));
    renderSettings();
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("30");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("60");
  });
});
