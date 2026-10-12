import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { AudioSettings } from "@ui/settings/AudioSettings";
import { AUDIO_REPEAT_DELAYS } from "@ui/audio/audioRepeatDelay";

const renderSettings = () => render(<InterfacePreferenceProvider><AudioSettings /></InterfacePreferenceProvider>);
describe("new cue defaults", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("persists and resets music repeat and group loop defaults", () => {
    const first = renderSettings();
    expect(screen.getByRole("switch", { name: "Repeat music cues by default" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Loop new Music groups by default" })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Repeat music cues by default" }));
    fireEvent.click(screen.getByRole("switch", { name: "Loop new Music groups by default" }));
    first.unmount();
    renderSettings();
    expect(screen.getByRole("switch", { name: "Repeat music cues by default" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Loop new Music groups by default" })).not.toBeChecked();
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("switch", { name: "Repeat music cues by default" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Loop new Music groups by default" })).toBeChecked();
  });
  it("persists Ambience type and threshold, retaining the threshold across modes", () => {
    const first = renderSettings();
    const mode = screen.getByRole("combobox", { name: "Default Ambience cue type" });
    expect(mode).toHaveValue("asset_icon");
    expect(within(mode).getAllByRole("option").map((option) => option.textContent)).toEqual(["Asset Icon", "Duration threshold", "Effect", "Track"]);
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(30);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" }), { target: { value: "45.5" } });
    fireEvent.change(mode, { target: { value: "effect" } });
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(45.5);
    first.unmount();
    renderSettings();
    const restored = screen.getByRole("combobox", { name: "Default Ambience cue type" });
    expect(restored).toHaveValue("effect");
    fireEvent.change(restored, { target: { value: "duration_threshold" } });
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(45.5);
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(restored).toHaveValue("asset_icon");
    fireEvent.change(restored, { target: { value: "duration_threshold" } });
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(30);
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
    act(() => globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("slider", { name: "Default cue volume" })).toHaveValue("50");
    expect(screen.getByRole("switch", { name: "Repeat music cues by default" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Loop new Music groups by default" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("0");
  });
  it("rejects unsupported persisted delay choices and invalid volume", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      audioCueVolumeDefault: 2,
      audioMusicCueRepeatDefault: "true",
      audioMusicGroupLoopDefault: 0,
      audioRepeatDelayDefaults: { minimumDelaySeconds: 7, maximumDelaySeconds: 99 }
    }));
    renderSettings();
    expect(screen.getByRole("slider", { name: "Default cue volume" })).toHaveValue("50");
    expect(screen.getByRole("switch", { name: "Repeat music cues by default" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Loop new Music groups by default" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay from" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Default Effect repeat delay to" })).toHaveValue("0");
  });
  it("validates and synchronizes Ambience preferences across tabs", () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ audioAmbienceCueTypeDefault: "invalid", audioAmbienceDurationThreshold: -1 }));
    renderSettings();
    const mode = screen.getByRole("combobox", { name: "Default Ambience cue type" });
    expect(mode).toHaveValue("asset_icon");
    fireEvent.change(mode, { target: { value: "duration_threshold" } });
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(30);
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ audioAmbienceCueTypeDefault: "duration_threshold", audioAmbienceDurationThreshold: 0 }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByRole("spinbutton", { name: "Audio duration threshold (seconds)" })).toHaveValue(0);
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
