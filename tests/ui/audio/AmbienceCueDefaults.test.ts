import { afterEach, describe, expect, it, vi } from "vitest";

import type { LibraryImageAsset } from "@library/types";
import { readAudioDuration, resolveAmbienceCueType } from "@ui/audio/ambienceCueDefaults";

const asset: LibraryImageAsset = { name: "Sound", mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } };

class MetadataAudio extends EventTarget {
  static last: MetadataAudio;
  src = "";
  duration = 30;
  preload = "";
  play = vi.fn();
  removeAttribute = vi.fn();
  constructor() { super(); MetadataAudio.last = this; }
}

describe("Ambience cue classification", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("uses the Library icon and fixed choices", () => {
    expect(resolveAmbienceCueType("asset_icon", asset, 30, 90)).toBe("effect");
    expect(resolveAmbienceCueType("asset_icon", { ...asset, audioIcon: "music" }, 30, 1)).toBe("track");
    expect(resolveAmbienceCueType("effect", { ...asset, audioIcon: "music" }, 30, 90)).toBe("effect");
    expect(resolveAmbienceCueType("track", asset, 30, 1)).toBe("track");
  });
  it.each([[29, "effect"], [30, "effect"], [30.01, "track"]] as const)("classifies duration %s as %s", (duration, type) => {
    expect(resolveAmbienceCueType("duration_threshold", asset, 30, duration)).toBe(type);
  });
  it.each([null, NaN, Infinity, -1])("falls back to the Library icon for unavailable duration %s", (duration) => {
    expect(resolveAmbienceCueType("duration_threshold", asset, 30, duration)).toBe("effect");
    expect(resolveAmbienceCueType("duration_threshold", { ...asset, audioIcon: "music" }, 30, duration)).toBe("track");
  });
  it("reads metadata without playback and releases the audio source", async () => {
    vi.stubGlobal("Audio", MetadataAudio);
    const reading = readAudioDuration("sound.mp3");
    MetadataAudio.last.dispatchEvent(new Event("loadedmetadata"));
    expect(await reading).toBe(30);
    expect(MetadataAudio.last.play).not.toHaveBeenCalled();
    expect(MetadataAudio.last.removeAttribute).toHaveBeenCalledWith("src");
  });
  it("returns unavailable duration on media failure or timeout", async () => {
    vi.stubGlobal("Audio", MetadataAudio);
    const failed = readAudioDuration("failed.mp3");
    MetadataAudio.last.dispatchEvent(new Event("error"));
    expect(await failed).toBeNull();
    vi.useFakeTimers();
    const timedOut = readAudioDuration("slow.mp3");
    await vi.advanceTimersByTimeAsync(10000);
    expect(await timedOut).toBeNull();
  });
});
